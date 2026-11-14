// -----------------------------------------------------------------------------
// The monitor: offers the emitters of the search in the Discover tab, reads
// the page of every emitter added to Gladys every `refresh_interval` minutes,
// publishes the states of its device, fires the scene trigger and serves the
// widget and the scene action.
//
// Trigger `new_message`: a message (a `data-id` of the page) seen for the
// first time on an emitter's page. The first reading of an emitter fires
// nothing: what is on the page then is not news (no burst with the history,
// at the first start nor when an emitter is added). An edited message keeps
// its id: it is not a new one. What was seen is kept under /data, so a
// restart fires nothing again.
//
// Load: one page at a time, a few seconds apart; nothing is read for the
// emitters offered but not added. States: `publishChangedStates` sends only
// what changed, plus a heartbeat every 12 hours.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { MAX_DISCOVERED } from './config.js';
import { buildDevice, deviceIds, emitterIdOf } from './device.js';
import {
  PHRASES,
  STATUS,
  TYPE_NAMES,
  clip,
  describe,
  join,
  localDay,
  render,
  titleOf,
} from './messages.js';
import { fetchMessages, pageUrl } from './panneaupocket.js';

const logger = createLogger({ name: 'panneaupocket' });

export const WIDGET_KEY = 'messages';
export const TRIGGER = 'new_message';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const DEFAULT_TIMINGS = {
  heartbeatMs: 12 * HOUR,
  // A message gone from its page for this long is forgotten.
  forgetAfterMs: 30 * DAY,
  // requestWidgetRefresh is rate-limited to one call every 10 s by the core.
  widgetRefreshMs: 10000,
  // Pause between two pages of the same cycle: the site serves people first.
  spacingMs: 3000,
};

// Scene events fired by one page reading at most: the core takes 300 a
// minute; more is an emitter publishing its whole archive at once.
export const MAX_EVENTS_PER_PAGE = 10;
// Scene variables: the core takes 1000 characters.
const MAX_VARIABLE = 1000;

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms).unref?.());

export class Monitor {
  /**
   * @param {object} options
   * @param {object} options.gladys GladysIntegration (or the SDK fake)
   * @param {object} options.store see src/store.js (panneaupocket.json)
   * @param {object} options.directory see src/emitters.js
   * @param {Function} [options.fetch] fetch
   * @param {boolean} [options.timers] false: no background timer (tests drive the cycles)
   * @param {Function} [options.now] clock in ms
   * @param {object} [options.timings] overrides of DEFAULT_TIMINGS
   */
  constructor({ gladys, store, directory, fetch: fetchImpl, timers = true, now, timings }) {
    this.gladys = gladys;
    this.store = store;
    this.directory = directory;
    this.fetch = fetchImpl ?? ((...args) => fetch(...args));
    this.timers = timers;
    this.now = now ?? (() => Date.now());
    this.timings = { ...DEFAULT_TIMINGS, ...timings };
    this.config = null;
    this.data = emptyData();
    // Emitter id → { messages, readAt } of its last successful reading.
    this.pages = new Map();
    // Emitter id → 'down' | 'missing' while its page cannot be read.
    this.pageErrors = new Map();
    // Emitter id → time of the last reading attempt, successful or not.
    this.attempts = new Map();
    this.search = { unmatched: [], truncated: false, listDown: false };
    this.statusMessage = undefined;
    this.cycleTimer = null;
    this.running = null;
    this.lastRefreshAt = -Infinity;
    this.refreshTimer = null;
    this.stopped = false;
    // Keys of the failures already logged, so a repeated one is not logged again.
    this.failing = new Set();
  }

  /** Log a failure once (warn or error), then at debug until `recovered(key)`. */
  failed(key, level, message, err) {
    const details = err ? [message, err] : [message];
    if (this.failing.has(key)) {
      logger.debug(...details);
      return;
    }
    this.failing.add(key);
    logger[level](...details);
  }

  /** One line when a failure logged by `failed(key)` is over. */
  recovered(key, message) {
    if (this.failing.delete(key)) {
      logger.info(message);
    }
  }

  // --- Lifecycle -------------------------------------------------------------

  async start(config) {
    this.config = config;
    const saved = await this.store.load();
    if (saved?.version === 1 && saved.emitters && typeof saved.emitters === 'object') {
      this.data = { ...emptyData(), ...saved };
    }
    try {
      await this.publishDiscovered();
    } catch (err) {
      // The followed emitters are read all the same; the next scan or
      // reconnection offers the search again.
      this.failed('discover', 'warn', `Publishing the discovered devices failed: ${err.message}`);
    }
    logger.info(
      `Started: ${this.followed().length} emitter(s) followed, read every ${config.refreshMinutes} min`,
    );
    this.schedule();
    this.runCycle();
  }

  /** Reconnection: Gladys may have restarted, publish everything again. */
  async resync(config) {
    this.config = config;
    await this.publishDiscovered();
    this.statusMessage = undefined;
    await this.updateConnectionStatus();
    this.gladys.forgetPublishedStates?.();
    await this.publishStates();
    this.requestRefresh();
  }

  async reconfigure(config) {
    // A cycle already running finishes with the old configuration.
    await this.running;
    this.config = config;
    logger.info('Configuration saved');
    await this.publishDiscovered();
    // The language may have changed: the latest message is written again.
    await this.publishStates();
    this.schedule();
    this.requestRefresh();
  }

  async stop() {
    this.stopped = true;
    clearInterval(this.cycleTimer);
    clearTimeout(this.refreshTimer);
    this.cycleTimer = null;
    await this.running?.catch(() => {});
    await this.store.flush();
    await this.directory.store.flush();
  }

  schedule() {
    if (!this.timers || this.stopped) {
      return;
    }
    clearInterval(this.cycleTimer);
    this.cycleTimer = setInterval(() => this.runCycle(), this.config.refreshMinutes * MINUTE);
    this.cycleTimer.unref?.();
  }

  // --- Discovery -------------------------------------------------------------

  /** The emitters of the search, as devices of the Discover tab. */
  async publishDiscovered() {
    const { terms, language } = this.config;
    this.search = { unmatched: [], truncated: false, listDown: false };
    let emitters = [];
    if (terms.length > 0) {
      try {
        if (await this.directory.ensure()) {
          this.recovered('list', 'The list of emitters can be read again');
          const found = this.directory.search(terms, MAX_DISCOVERED);
          emitters = found.emitters;
          this.search.unmatched = found.unmatched;
          this.search.truncated = found.truncated;
        } else {
          this.search.listDown = true;
        }
      } catch (err) {
        this.search.listDown = true;
        this.failed('list', 'warn', `The list of emitters cannot be read: ${err.message}`);
      }
    }
    logger.debug(`Search: ${emitters.length} emitter(s) offered`);
    await this.gladys.publishDiscoveredDevices(
      emitters.map((emitter) => buildDevice(this.gladys, emitter, language)),
    );
    this.recovered('discover', 'Publishing the discovered devices works again');
    await this.updateConnectionStatus();
  }

  // --- Followed emitters -------------------------------------------------------

  /** The emitters added to Gladys: `[{ id, device, name, link }]`. */
  followed() {
    const list = [];
    for (const device of this.gladys.devices ?? []) {
      const id = emitterIdOf(this.gladys, device.external_id);
      if (id) {
        list.push(this.emitterOf(id, device));
      }
    }
    return list;
  }

  emitterOf(id, device) {
    const param = (device?.params ?? []).find((p) => p.name === 'page')?.value;
    const listed = this.directory.get(id);
    return {
      id,
      device: device ?? null,
      // The name given in Gladys, which the user may have changed.
      name: device?.name || listed?.name || id,
      link: pageUrl(id, param ?? listed?.link),
    };
  }

  /** The messages of a followed emitter, newest first, alerts not set apart. */
  messagesOf(id) {
    return this.pages.get(id)?.messages ?? [];
  }

  // --- Cycles ------------------------------------------------------------------

  runCycle(only = null) {
    if (this.running || this.stopped) {
      return this.running;
    }
    this.running = this.cycle(only)
      .catch((err) => this.failed('cycle', 'error', 'Refresh cycle failed', err))
      .finally(() => {
        this.running = null;
      });
    return this.running;
  }

  /**
   * Read the page of every followed emitter (or of `only`), skipping the ones
   * read less than half an interval ago (onPoll, scene actions).
   */
  async cycle(only) {
    const halfInterval = (this.config.refreshMinutes * MINUTE) / 2;
    const emitters = this.followed().filter((emitter) => !only || emitter.id === only);
    let first = true;
    for (const emitter of emitters) {
      if (this.stopped) {
        break;
      }
      const attempt = this.attempts.get(emitter.id);
      if (attempt !== undefined && this.now() - attempt < halfInterval) {
        continue;
      }
      if (!first && this.timings.spacingMs > 0) {
        await sleep(this.timings.spacingMs);
      }
      first = false;
      await this.read(emitter);
    }
    this.forgetRemoved();
    this.store.save(this.data);
    this.recovered('cycle', 'Refresh cycles work again');
    await this.updateConnectionStatus();
  }

  /** Read one page, fire the trigger for its new messages, publish its states. */
  async read(emitter) {
    // A page that fails is not tried again before half an interval either.
    this.attempts.set(emitter.id, this.now());
    let parsed;
    try {
      parsed = await fetchMessages(this.fetch, emitter);
    } catch (err) {
      const kind = err.status === 404 ? 'missing' : 'down';
      this.pageErrors.set(emitter.id, kind);
      this.failed(
        `page:${emitter.id}`,
        'warn',
        kind === 'missing'
          ? `Emitter ${emitter.id} no longer exists on PanneauPocket`
          : `Page of emitter ${emitter.id} unreachable: ${err.message}`,
      );
      return;
    }
    this.pageErrors.delete(emitter.id);
    this.recovered(`page:${emitter.id}`, `Page of emitter ${emitter.id} read again`);
    const now = this.now();
    const seen = this.data.emitters[emitter.id];
    const known = seen?.known ?? {};
    const fresh = [];
    for (const message of parsed) {
      if (known[message.id]) {
        known[message.id].last = now;
      } else {
        // Seeding: the messages already on the page get no first-seen day,
        // so an undated event does not pass for the latest message.
        known[message.id] = { first: seen ? now : 0, last: now };
        if (seen) {
          fresh.push(message);
        }
      }
    }
    for (const [id, times] of Object.entries(known)) {
      if (now - times.last > this.timings.forgetAfterMs) {
        delete known[id];
      }
    }
    this.data.emitters[emitter.id] = { known };
    const messages = parsed
      .map((message, index) => ({
        ...message,
        index,
        day:
          message.published ??
          (known[message.id].first > 0 ? localDay(known[message.id].first) : null),
      }))
      .sort(newestFirst);
    const previous = this.pages.get(emitter.id);
    this.pages.set(emitter.id, { messages, readAt: now });
    logger.debug(
      `Emitter ${emitter.id}: ${messages.length} message(s), ${fresh.length} new${seen ? '' : ' (first reading, taken as known)'}`,
    );
    // Saved before the triggers fire: a stop in the middle of a long cycle
    // must not announce them again at the restart.
    this.store.save(this.data);
    // Oldest first, so the scenes hear them in the order of publication.
    // Beyond the cap, alerts are still all announced.
    const ordered = messages.filter((message) => fresh.some((f) => f.id === message.id)).reverse();
    let others = 0;
    for (const message of ordered) {
      if (message.type !== 'alert') {
        others += 1;
        if (others > MAX_EVENTS_PER_PAGE) {
          logger.debug(
            `New message ${message.id} not announced (more than ${MAX_EVENTS_PER_PAGE})`,
          );
          continue;
        }
      }
      await this.fire(emitter, message);
    }
    await this.publishStates(emitter);
    if (signature(previous?.messages) !== signature(messages)) {
      this.requestRefresh();
    }
  }

  /** Forget what was seen of the emitters no longer in Gladys: added again, they are seeded again. */
  forgetRemoved() {
    const ids = new Set(this.followed().map((emitter) => emitter.id));
    for (const id of Object.keys(this.data.emitters)) {
      if (!ids.has(id)) {
        delete this.data.emitters[id];
        this.pages.delete(id);
        this.pageErrors.delete(id);
        this.attempts.delete(id);
      }
    }
  }

  async fire(emitter, message) {
    // A village publishes a few messages a week: the logs do not keep them.
    logger.debug(`New message ${message.id} from emitter ${emitter.id}`);
    try {
      await this.gladys.publishSceneEvent(TRIGGER, this.eventData(emitter, message));
      this.recovered('scene', 'Scene triggers work again');
    } catch (err) {
      // Not sent again: a message announced late is worse than one missed,
      // and the widget and the device still show it.
      this.failed('scene', 'warn', `Firing the scene trigger failed: ${err.message}`);
    }
  }

  /** The flat data of a scene event (fields, then variables of the manifest). */
  eventData(emitter, message) {
    const language = this.config.language;
    const typeName = TYPE_NAMES[language][message.type];
    const title = titleOf(message);
    return {
      emitter: deviceIds(this.gladys, emitter.id).device,
      type: message.type,
      emitter_name: clip(emitter.name, 200),
      type_name: typeName,
      title: clip(title, 300),
      text: clip(message.text || title, MAX_VARIABLE),
      date: message.dateLine || '—',
      url: emitter.link,
      summary: clip(
        PHRASES[language].summary({
          emitter: emitter.name,
          // German nouns keep their capital.
          type: language === 'de' ? typeName : typeName.toLowerCase(),
          title,
        }),
        MAX_VARIABLE,
      ),
    };
  }

  // --- States ------------------------------------------------------------------

  statesOf(id) {
    const page = this.pages.get(id);
    if (!page) {
      return [];
    }
    const ids = deviceIds(this.gladys, id);
    const language = this.config.language;
    const [latest] = page.messages;
    return [
      { device_feature_external_id: ids.messages, state: Math.min(page.messages.length, 1000) },
      {
        device_feature_external_id: ids.alerts,
        state: Math.min(page.messages.filter((m) => m.type === 'alert').length, 1000),
      },
      {
        device_feature_external_id: ids.latest,
        text: latest ? describe(latest, language) : PHRASES[language].none,
      },
    ];
  }

  /** Publish the states of one emitter, or of every followed one. */
  async publishStates(only = null) {
    const ids = only ? [only.id] : this.followed().map((emitter) => emitter.id);
    const states = ids.flatMap((id) => this.statesOf(id));
    if (states.length === 0) {
      return;
    }
    try {
      await this.gladys.publishChangedStates(states, { heartbeat: this.timings.heartbeatMs });
      this.recovered('publish', 'Publishing the states works again');
    } catch (err) {
      // Sent again at the next cycle (the SDK forgets what Gladys refused).
      this.failed('publish', 'warn', `Publishing the states failed: ${err.message}`);
    }
  }

  async updateConnectionStatus() {
    const parts = [];
    if (this.search.listDown) {
      parts.push(render(STATUS, 'listDown'));
    }
    if (this.search.unmatched.length > 0) {
      parts.push(render(STATUS, 'unmatched', { values: this.search.unmatched.join(', ') }));
    }
    if (this.search.truncated) {
      parts.push(render(STATUS, 'truncated', { max: MAX_DISCOVERED }));
    }
    const followed = new Map(this.followed().map((emitter) => [emitter.id, emitter]));
    const namesOf = (kind) =>
      [...this.pageErrors]
        .filter(([id, error]) => error === kind && followed.has(id))
        .map(([id]) => followed.get(id).name)
        .join(', ');
    const down = namesOf('down');
    const missing = namesOf('missing');
    if (down) {
      parts.push(render(STATUS, 'pagesDown', { names: clip(down, 120) }));
    }
    if (missing) {
      parts.push(render(STATUS, 'notFound', { names: clip(missing, 120) }));
    }
    const message = parts.length > 0 ? join(...parts) : undefined;
    // Connected unless nothing works: a page or the search failing is said
    // in the message, the other emitters keep working.
    const allDown =
      followed.size > 0 && [...followed.keys()].every((id) => this.pageErrors.has(id));
    const connected = !allDown && !(followed.size === 0 && this.search.listDown);
    const key = JSON.stringify([connected, message]);
    if (key === this.statusMessage) {
      return;
    }
    this.statusMessage = key;
    await this.gladys.setConnectionStatus(connected, message).catch(() => {});
  }

  // --- Gladys events -----------------------------------------------------------

  async onDeviceCreated(device) {
    const id = emitterIdOf(this.gladys, device?.external_id);
    if (!id) {
      return;
    }
    await this.running;
    if (!this.pages.has(id)) {
      await this.read(this.emitterOf(id, device));
      this.store.save(this.data);
      await this.updateConnectionStatus();
    }
    // The SDK forgot the states of the device: everything is published again.
    await this.publishStates({ id });
    this.requestRefresh();
  }

  async onDeviceChanged() {
    await this.updateConnectionStatus();
    this.requestRefresh();
  }

  /** onPoll fallback: should_poll is false, but a Gladys polling anyway gets an answer. */
  async poll(device) {
    const id = emitterIdOf(this.gladys, device?.external_id);
    if (!id) {
      return;
    }
    await this.runCycle(id);
    await this.publishStates({ id });
  }

  /** The followed emitters with their messages, read again if older than one interval. */
  async fresh(only = null) {
    const interval = this.config.refreshMinutes * MINUTE;
    const stale = this.followed().some((emitter) => {
      const attempt = this.attempts.get(emitter.id);
      return (
        (!only || emitter.id === only) &&
        (attempt === undefined || this.now() - attempt >= interval)
      );
    });
    if (stale) {
      await this.running;
      await this.runCycle(only);
    } else {
      await this.running;
    }
    return this.followed().filter((emitter) => !only || emitter.id === only);
  }

  // --- Widget -------------------------------------------------------------------

  requestRefresh() {
    if (this.stopped) {
      return;
    }
    const now = this.now();
    const wait = this.lastRefreshAt + this.timings.widgetRefreshMs - now;
    if (wait <= 0) {
      this.lastRefreshAt = now;
      this.gladys.requestWidgetRefresh(WIDGET_KEY);
    } else if (this.timers && !this.refreshTimer) {
      this.refreshTimer = setTimeout(() => {
        this.refreshTimer = null;
        this.requestRefresh();
      }, wait);
      this.refreshTimer.unref?.();
    }
  }
}

/** Newest first: by day (undated last), then in the order of the page. */
function newestFirst(a, b) {
  if (a.day !== b.day) {
    if (!a.day) {
      return 1;
    }
    if (!b.day) {
      return -1;
    }
    return a.day < b.day ? 1 : -1;
  }
  return a.index - b.index;
}

const signature = (messages) =>
  (messages ?? []).map((m) => `${m.id}:${m.type}:${m.dateLine}:${m.title}`).join(',');

function emptyData() {
  return { version: 1, emitters: {} };
}

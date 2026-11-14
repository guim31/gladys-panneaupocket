// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake PanneauPocket serving
// the pages and the list recorded on 14/11/2026 (test/fixtures/panneaupocket),
// a manual clock, a temporary /data, and the integration wired on top through
// registerHandlers. Nothing touches the network.
// -----------------------------------------------------------------------------

import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';
import { EMITTERS_URL, SITE_URL } from '../../src/panneaupocket.js';

process.env.LOG_LEVEL ??= 'silent';
process.env.TZ = 'Europe/Paris';

export const fixture = (name) =>
  readFileSync(new URL(`../fixtures/panneaupocket/${name}`, import.meta.url), 'utf8');

export const START = Date.parse('2026-11-14T21:00:00Z');

// Emitters of the recording.
export const NAILLY = '1764110563'; // 89100, 15 messages, 2 alerts
export const TIGY = '689163842'; // 45510, 23 messages, 3 events
export const COLLEMIERS = '1979787416'; // 89100, in the list, page not recorded: served empty
export const UNKNOWN = '123456789'; // in no list: a 404

const PAGES = {
  [NAILLY]: fixture('nailly-2026-11-14.html'),
  [TIGY]: fixture('tigy-2026-11-14.html'),
};

/** A page without any message: a recorded one, cut before its first message. */
export function emptyPage(html = PAGES[TIGY]) {
  return `${html.slice(0, html.indexOf('<div class="sign-carousel--item'))}</div></div></body></html>`;
}

/**
 * Fake PanneauPocket. `site.down`: 'network', a status (503) or false.
 * `site.pages` maps an emitter id to its HTML; an id listed but without a
 * page is served empty, an id in no list is a 404.
 */
export function createSite() {
  const emitters = JSON.parse(fixture('emitters-2026-11-14.json'));
  const site = {
    emitters,
    pages: { ...PAGES },
    down: false,
    requests: [],

    /** Put a new message at the top of a page, copied from its first one. */
    publish(id, { messageId, title, type = 'info', date = '14/11/2026' }) {
      const html = site.pages[id];
      const start = html.indexOf('<div class="sign-carousel--item');
      const next = html.indexOf('<div class="sign-carousel--item', start + 10);
      let block = html.slice(start, next).replace(/data-id="\d+"/, `data-id="${messageId}"`);
      block = block
        .replace(/\/build\/images\/sign\/[a-z]+\./, `/build/images/sign/${type}.`)
        .replace(
          /<span class="date">[\s\S]*?<\/span>/,
          `<span class="date">Info publiée le ${date}</span>`,
        )
        .replace(/(<div class="title">)[\s\S]*?(<\/div>)/, `$1${title}$2`);
      site.pages[id] = html.slice(0, start) + block + html.slice(start);
    },

    async fetch(input) {
      const url = String(input);
      site.requests.push(url);
      if (site.down === 'network') {
        throw new TypeError('fetch failed');
      }
      if (site.down) {
        return { status: site.down, text: async () => 'Service Unavailable' };
      }
      if (url === EMITTERS_URL) {
        return { status: 200, text: async () => JSON.stringify(site.emitters) };
      }
      const match = new RegExp(`^${SITE_URL}/ville/(\\d+)-`).exec(url);
      const id = match?.[1];
      if (id && site.pages[id] !== undefined) {
        return { status: 200, text: async () => site.pages[id] };
      }
      if (id && site.emitters.some((emitter) => String(emitter.id) === id)) {
        return { status: 200, text: async () => emptyPage() };
      }
      return { status: 404, text: async () => fixture('not-found-2026-11-14.html') };
    },
  };
  return site;
}

/** A manual clock. */
export function createClock(start = START) {
  const clock = {
    time: start,
    now: () => clock.time,
    advance(ms) {
      clock.time += ms;
    },
  };
  return clock;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {Array} [options.devices] devices already created in Gladys
 */
export async function createWorld({
  config = {},
  devices = [],
  site = createSite(),
  connect = true,
  clock = createClock(),
  dataDir = mkdtempSync(join(tmpdir(), 'gladys-panneaupocket-')),
} = {}) {
  const gladys = createFakeGladys({ config, devices });
  const app = registerHandlers(gladys, {
    dataDir,
    fetch: site.fetch,
    timers: false,
    now: clock.now,
    timings: { spacingMs: 0 },
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
    await app.monitor.running;
  }
  return { gladys, fake: gladys.fake, app, monitor: app.monitor, site, clock, dataDir };
}

/** The discovered device of an emitter. */
export const discovered = (world, id) =>
  world.fake.discoveredDevices.find((device) => device.external_id.endsWith(`:emitter:${id}`));

/** Add an emitter to Gladys, as the user would from the Discover tab. */
export async function create(world, id) {
  const device = discovered(world, id);
  if (!device) {
    throw new Error(`emitter ${id} not discovered`);
  }
  await world.fake.deviceCreated(device);
  return device;
}

/** External id of one feature of a device. */
export const featureId = (device, key) =>
  device.features.find((feature) => feature.external_id.endsWith(`:${key}`))?.external_id;

/** Run one refresh cycle, `minutes` later. */
export async function cycle(world, minutes = 30) {
  world.clock.advance(minutes * 60 * 1000);
  await world.monitor.runCycle();
}

/**
 * Capture the integration's log lines at `level` and above (LOG_LEVEL is read
 * at every call). Returns the lines as `{ level, text }`.
 */
export function captureLogs(t, level = 'info') {
  const previous = process.env.LOG_LEVEL;
  process.env.LOG_LEVEL = level;
  const lines = [];
  const record = (...args) => {
    const text = args.map((arg) => (arg instanceof Error ? arg.message : String(arg))).join(' ');
    const match = /^\[[^\]]+\] \[(\w+)\]/.exec(text);
    lines.push({ level: match ? match[1].toLowerCase() : 'raw', text });
  };
  t.mock.method(console, 'log', record);
  t.mock.method(console, 'error', record);
  t.after(() => {
    process.env.LOG_LEVEL = previous;
  });
  return lines;
}

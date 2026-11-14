// -----------------------------------------------------------------------------
// The list of the PanneauPocket emitters and the search of the configuration.
//
// The list is about 16,000 entries (6.5 MB as sent, 2.5 MB once reduced): it
// is read at most once a day, only when a search needs it, and kept under
// /data/emitters.json so a restart does not read it again. A failed reading is
// tried again an hour later at the soonest; meanwhile the copy on disk, even
// old, keeps serving.
// -----------------------------------------------------------------------------

import { fold } from './config.js';
import { fetchEmitters } from './panneaupocket.js';

const HOUR = 60 * 60 * 1000;
export const LIST_MAX_AGE_MS = 24 * HOUR;
export const LIST_RETRY_MS = HOUR;
// Without any list, a failed reading is tried again sooner.
export const FIRST_LIST_RETRY_MS = 5 * 60 * 1000;

export class Directory {
  /**
   * @param {object} options
   * @param {object} options.store a Store on emitters.json
   * @param {Function} options.fetch
   * @param {Function} options.now clock in ms
   */
  constructor({ store, fetch: fetchImpl, now }) {
    this.store = store;
    this.fetch = fetchImpl;
    this.now = now;
    this.emitters = null;
    this.byId = new Map();
    this.fetchedAt = null;
    this.lastAttemptAt = -Infinity;
    this.loaded = false;
    this.ensuring = null;
  }

  async load() {
    if (this.loaded) {
      return;
    }
    this.loaded = true;
    const saved = await this.store.load();
    if (saved?.version === 1 && Array.isArray(saved.emitters)) {
      this.use(saved.emitters, saved.fetchedAt ?? 0);
    }
  }

  use(emitters, fetchedAt) {
    // Folded once: a name search runs over the whole list.
    this.emitters = emitters.map((emitter) => ({
      ...emitter,
      foldedCity: fold(emitter.city),
      foldedName: ` ${fold(emitter.name)} `,
    }));
    this.byId = new Map(this.emitters.map((emitter) => [emitter.id, emitter]));
    this.fetchedAt = fetchedAt;
  }

  get stale() {
    return this.fetchedAt === null || this.now() - this.fetchedAt >= LIST_MAX_AGE_MS;
  }

  /**
   * Read the list again if it is older than a day (and the last attempt older
   * than an hour). Resolves true when a list is available, old or new; throws
   * the error of the reading when none is.
   */
  async ensure() {
    // One reading at a time: a scan during the start waits for it.
    this.ensuring ??= this.refresh().finally(() => {
      this.ensuring = null;
    });
    return this.ensuring;
  }

  async refresh() {
    await this.load();
    const retry = this.emitters === null ? FIRST_LIST_RETRY_MS : LIST_RETRY_MS;
    if (!this.stale || this.now() - this.lastAttemptAt < retry) {
      return this.emitters !== null;
    }
    this.lastAttemptAt = this.now();
    try {
      const emitters = await fetchEmitters(this.fetch);
      this.use(emitters, this.now());
      this.store.save({ version: 1, fetchedAt: this.fetchedAt, emitters });
    } catch (err) {
      if (this.emitters === null) {
        throw err;
      }
    }
    return true;
  }

  get(id) {
    return this.byId.get(String(id)) ?? null;
  }

  /**
   * The emitters matching the search terms, in the order of the terms, at most
   * `max`. `unmatched`: the raw terms that found nothing; `truncated`: more
   * emitters matched than `max`.
   */
  search(terms, max) {
    const found = new Map();
    const unmatched = [];
    let truncated = false;
    for (const term of terms) {
      const matches = this.match(term);
      if (matches.length === 0) {
        unmatched.push(term.raw);
      }
      for (const emitter of matches) {
        if (found.size >= max && !found.has(emitter.id)) {
          truncated = true;
          break;
        }
        found.set(emitter.id, emitter);
      }
    }
    return {
      emitters: [...found.values()].map(({ id, name, postCode, city, link }) => ({
        id,
        name,
        postCode,
        city,
        link,
      })),
      unmatched,
      truncated,
    };
  }

  match(term) {
    const list = this.emitters ?? [];
    if (term.kind === 'id') {
      const emitter = this.get(term.value);
      return emitter ? [emitter] : [];
    }
    if (term.kind === 'postcode') {
      return sortByName(list.filter((emitter) => emitter.postCode === term.value));
    }
    // A name: the commune itself, or an emitter whose name holds the words
    // ("sens" finds "Gendarmerie COB de Sens", not "Sensac").
    const words = ` ${term.value} `;
    return sortByName(
      list.filter(
        (emitter) => emitter.foldedCity === term.value || emitter.foldedName.includes(words),
      ),
    );
  }
}

const sortByName = (list) =>
  [...list].sort((a, b) => a.name.localeCompare(b.name, 'fr') || a.id.localeCompare(b.id));

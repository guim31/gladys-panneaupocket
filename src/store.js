// -----------------------------------------------------------------------------
// Small JSON persistence under /data (the only writable path of the container):
// `panneaupocket.json`, the messages already seen of each emitter, so a restart
// fires no scene trigger for something that is not news; `emitters.json`, the
// list of the PanneauPocket emitters, read at most once a day. Losing a file is
// harmless: the messages on the pages at the next start are taken as known, and
// the list is read again.
// -----------------------------------------------------------------------------

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '@gladysassistant/integration-sdk';

const logger = createLogger({ name: 'panneaupocket-store' });

export class Store {
  constructor(
    directory = process.env.PANNEAUPOCKET_DATA_DIR || '/data',
    fileName = 'panneaupocket.json',
  ) {
    this.directory = directory;
    this.path = join(directory, fileName);
    this.pending = null;
    this.writing = null;
    // A failing disk would fail every save: logged once, then at debug.
    this.writeFailed = false;
  }

  async load() {
    try {
      const data = JSON.parse(await readFile(this.path, 'utf8'));
      return data && typeof data === 'object' ? data : {};
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn(`Cannot read ${this.path}: ${err.message}`);
      }
      return {};
    }
  }

  // Writes are coalesced and atomic (temporary file + rename): a crash never
  // leaves half a JSON file behind.
  save(data) {
    this.latest = data;
    if (!this.pending) {
      // Chained after the write in progress, if any: one writer at a time.
      this.pending = (this.writing ?? Promise.resolve()).then(async () => {
        const snapshot = this.latest;
        this.pending = null;
        try {
          await mkdir(this.directory, { recursive: true });
          const temporary = `${this.path}.tmp`;
          await writeFile(temporary, JSON.stringify(snapshot));
          await rename(temporary, this.path);
          if (this.writeFailed) {
            this.writeFailed = false;
            logger.info(`${this.path} written again`);
          }
        } catch (err) {
          if (this.writeFailed) {
            logger.debug(`Cannot write ${this.path}: ${err.message}`);
          } else {
            this.writeFailed = true;
            logger.warn(`Cannot write ${this.path}: ${err.message}`);
          }
        }
      });
      this.writing = this.pending;
    }
    return this.pending;
  }

  /** Resolves once every write requested so far is on disk. */
  flush() {
    return this.writing ?? Promise.resolve();
  }
}

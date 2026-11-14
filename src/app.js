// -----------------------------------------------------------------------------
// Registers every SDK handler on a GladysIntegration (or the SDK's fake Gladys)
// and returns the monitor, so index.js stays a few lines and the tests drive
// the very same wiring.
// -----------------------------------------------------------------------------

import { createLogger } from '@gladysassistant/integration-sdk';
import { SCENE_ACTION, readMessages } from './actions.js';
import { normalizeConfig } from './config.js';
import { Directory } from './emitters.js';
import { STATUS, render } from './messages.js';
import { Monitor } from './monitor.js';
import { Store } from './store.js';
import { WIDGETS } from './widgets.js';

const logger = createLogger({ name: 'panneaupocket-app' });

/**
 * @param {object} gladys GladysIntegration instance
 * @param {object} [options] test seams: dataDir, fetch, timers, now, timings
 */
export function registerHandlers(gladys, options = {}) {
  const now = options.now ?? (() => Date.now());
  const fetchImpl = options.fetch ?? ((...args) => fetch(...args));
  const monitor = new Monitor({
    gladys,
    store: new Store(options.dataDir),
    directory: new Directory({
      store: new Store(options.dataDir, 'emitters.json'),
      fetch: fetchImpl,
      now,
    }),
    fetch: fetchImpl,
    timers: options.timers ?? true,
    now,
    timings: options.timings,
  });

  // Resolved once the monitor has started; every handler waits for it, so a
  // request arriving during the start is not lost.
  let resolveReady;
  const ready = new Promise((resolve) => {
    resolveReady = resolve;
  });
  let started = false;
  const whenReady =
    (fn) =>
    async (...args) => {
      await ready;
      return fn(...args);
    };

  gladys.on('connected', async () => {
    try {
      const config = normalizeConfig(await gladys.getConfig());
      if (started) {
        // A reconnection (Gladys restarted): publish everything again.
        await monitor.resync(config);
        return;
      }
      await monitor.start(config);
      // Only now: a failed start is tried again at the next connection.
      started = true;
    } catch (err) {
      logger.error('Initialization failed', err);
      await gladys.setConnectionStatus(false, render(STATUS, 'initFailed')).catch(() => {});
    } finally {
      resolveReady();
    }
  });

  gladys.onScanRequest(whenReady(() => monitor.publishDiscovered()));

  // The devices are published with should_poll: false (read by the monitor's
  // own timer); this only serves a Gladys that would poll anyway.
  gladys.onPoll(whenReady((device) => monitor.poll(device)));

  gladys.onDeviceCreated(whenReady((device) => monitor.onDeviceCreated(device)));
  gladys.onDeviceUpdated(whenReady(() => monitor.onDeviceChanged()));
  gladys.onDeviceDeleted(whenReady(() => monitor.onDeviceChanged()));

  gladys.onConfigUpdated(whenReady((newConfig) => monitor.reconfigure(normalizeConfig(newConfig))));

  gladys.onSceneAction(
    SCENE_ACTION,
    whenReady((fields) => readMessages(monitor, fields)),
  );

  for (const [key, widget] of Object.entries(WIDGETS)) {
    gladys.onWidgetGet(
      key,
      whenReady((request) => widget.get(monitor, request)),
    );
  }

  return {
    monitor,
    ready,
    stop: () => monitor.stop(),
  };
}

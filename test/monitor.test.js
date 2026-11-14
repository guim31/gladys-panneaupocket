// -----------------------------------------------------------------------------
// The monitor end to end, against the SDK's fake Gladys and the recorded
// pages: discovery from the search, states, the `new_message` trigger (never
// for what was already on the page), the container's own timer, failures.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeConfig } from '../src/config.js';
import { TRIGGER } from '../src/monitor.js';
import {
  COLLEMIERS,
  NAILLY,
  TIGY,
  create,
  createClock,
  createSite,
  createWorld,
  cycle,
  featureId,
} from './helpers/world.js';

async function world(t, options = {}) {
  const w = await createWorld({ config: { search: '89100, Tigy' }, ...options });
  t.after(() => w.app.stop());
  return w;
}

const lastState = (w, device, key) => w.fake.lastState(featureId(device, key));

test('the search offers its emitters, and nothing is read before one is added', async (t) => {
  const w = await world(t);
  assert.equal(w.fake.discoveredDevices.length, 20);
  const nailly = w.fake.discoveredDevices.find((d) => d.name === 'Nailly (89100)');
  assert.ok(nailly);
  assert.equal(nailly.should_poll, false);
  assert.equal(nailly.poll_frequency, undefined);
  // The list only: no page read for emitters merely offered.
  assert.deepEqual(w.site.requests, ['https://app.panneaupocket.com/public-api/city']);
  assert.deepEqual(w.fake.sceneEvents, []);
});

test('an added emitter is read at once: counts and latest message, no trigger for its history', async (t) => {
  const w = await world(t);
  const device = await create(w, NAILLY);
  assert.equal(lastState(w, device, 'messages'), 15);
  assert.equal(lastState(w, device, 'alerts'), 2);
  assert.equal(lastState(w, device, 'latest_message'), '13/11 · Appel à bénévoles');
  assert.deepEqual(w.fake.sceneEvents, []);
});

test('a new message fires new_message once, with its texts', async (t) => {
  const w = await world(t);
  const device = await create(w, NAILLY);
  w.site.publish(NAILLY, { messageId: '555', title: 'Coupure d’eau', type: 'alert' });
  await cycle(w);
  assert.equal(w.fake.sceneEvents.length, 1);
  const [event] = w.fake.sceneEvents;
  assert.equal(event.key, TRIGGER);
  assert.equal(event.data.emitter, device.external_id);
  assert.equal(event.data.type, 'alert');
  assert.equal(event.data.type_name, 'Alerte');
  assert.equal(event.data.title, 'Coupure d’eau');
  assert.equal(event.data.emitter_name, 'Nailly (89100)');
  assert.equal(event.data.summary, 'Nailly (89100), alerte : Coupure d’eau');
  assert.match(event.data.url, /^https:\/\/app\.panneaupocket\.com\/ville\/1764110563-/);
  assert.equal(lastState(w, device, 'messages'), 16);
  assert.equal(lastState(w, device, 'alerts'), 3);
  assert.equal(lastState(w, device, 'latest_message'), '14/11 · Coupure d’eau');
  await cycle(w);
  assert.equal(w.fake.sceneEvents.length, 1);
});

test('a restart fires nothing again, and a lost /data fires nothing either', async (t) => {
  const site = createSite();
  const clock = createClock();
  const first = await world(t, { site, clock });
  const device = await create(first, NAILLY);
  await first.app.stop();
  site.publish(NAILLY, { messageId: '556', title: 'Réunion publique' });
  const devices = [{ ...device, name: 'Mairie' }];
  const second = await world(t, { site, clock, devices, dataDir: first.dataDir });
  assert.deepEqual(
    second.fake.sceneEvents.map((e) => e.data.title),
    ['Réunion publique'],
  );
  assert.equal(second.fake.sceneEvents[0].data.emitter_name, 'Mairie');
  await second.app.stop();
  site.publish(NAILLY, { messageId: '557', title: 'Encore' });
  const third = await world(t, { site, clock, devices });
  assert.deepEqual(third.fake.sceneEvents, []);
});

test("the container reads the pages on its own timer, without Gladys' polling", async (t) => {
  t.mock.timers.enable({ apis: ['setInterval', 'setTimeout'] });
  const site = createSite();
  const w = await createWorld({ config: { search: '89100', refresh_interval: '15' }, site });
  t.after(() => w.app.stop());
  w.app.monitor.timers = true;
  w.app.monitor.schedule();
  await create(w, NAILLY);
  const pageReads = () => site.requests.filter((url) => url.includes(`/ville/${NAILLY}-`)).length;
  assert.equal(pageReads(), 1);
  w.clock.advance(15 * 60 * 1000);
  t.mock.timers.tick(15 * 60 * 1000);
  await w.monitor.running;
  assert.equal(pageReads(), 2);
});

test('onPoll reads again only after half an interval', async (t) => {
  const w = await world(t);
  const device = await create(w, NAILLY);
  const reads = () => w.site.requests.filter((url) => url.includes('/ville/')).length;
  await w.fake.poll(device);
  assert.equal(reads(), 1);
  w.clock.advance(16 * 60 * 1000);
  await w.fake.poll(device);
  assert.equal(reads(), 2);
});

test('an empty page counts zero, an unknown emitter and a site down are said', async (t) => {
  const w = await world(t);
  const empty = await create(w, COLLEMIERS);
  assert.equal(lastState(w, empty, 'messages'), 0);
  assert.equal(lastState(w, empty, 'latest_message'), 'Aucun message');
  const nailly = await create(w, NAILLY);
  // An emitter removed from PanneauPocket since it was added.
  delete w.site.pages[NAILLY];
  w.site.emitters = w.site.emitters.filter((e) => String(e.id) !== NAILLY);
  await cycle(w);
  let status = w.fake.connectionStatus;
  assert.equal(status.connected, true);
  assert.match(status.message.fr, /N'est plus sur PanneauPocket : Nailly \(89100\)/);
  // Everything down: disconnected; back: connected without message.
  w.site.down = 503;
  await cycle(w);
  status = w.fake.connectionStatus;
  assert.equal(status.connected, false);
  assert.match(status.message.en, /PanneauPocket does not answer for: .*Collemiers/);
  w.site.down = false;
  await w.fake.deviceDeleted(nailly);
  await cycle(w);
  status = w.fake.connectionStatus;
  assert.equal(status.connected, true);
  assert.equal(status.message, undefined);
});

test('a search finding nothing is said in the status', async (t) => {
  const w = await world(t, { config: { search: 'Atlantis' } });
  assert.deepEqual(w.fake.discoveredDevices, []);
  assert.match(w.fake.connectionStatus.message.fr, /Aucun émetteur trouvé pour : Atlantis/);
  await w.fake.configUpdated({ search: TIGY });
  assert.equal(w.fake.discoveredDevices.length, 1);
  assert.equal(w.fake.connectionStatus.message, undefined);
});

test('the list of emitters unreachable: the search is said unavailable', async (t) => {
  const site = createSite();
  site.down = 'network';
  const w = await world(t, { site });
  assert.deepEqual(w.fake.discoveredDevices, []);
  assert.equal(w.fake.connectionStatus.connected, false);
  assert.match(w.fake.connectionStatus.message.en, /list of PanneauPocket emitters cannot be read/);
});

test('the feature names follow the language of the configuration', async (t) => {
  const w = await world(t);
  await w.monitor.reconfigure(normalizeConfig({ search: TIGY, language: 'de' }));
  const [device] = w.fake.discoveredDevices;
  assert.deepEqual(
    device.features.map((f) => f.name),
    ['Aktuelle Meldungen', 'Aktuelle Warnungen', 'Neueste Meldung'],
  );
});

test('a language change rewrites the latest message at once', async (t) => {
  const w = await world(t);
  const device = await create(w, COLLEMIERS);
  assert.equal(lastState(w, device, 'latest_message'), 'Aucun message');
  await w.fake.configUpdated({ search: '89100', language: 'en' });
  assert.equal(lastState(w, device, 'latest_message'), 'No message');
});

test('beyond the cap of a reading, the alerts are still announced', async (t) => {
  const w = await world(t);
  await create(w, NAILLY);
  for (let i = 0; i < 12; i += 1) {
    w.site.publish(NAILLY, { messageId: String(800 + i), title: `Info ${i}` });
  }
  w.site.publish(NAILLY, { messageId: '899', title: 'Alerte crue', type: 'alert' });
  await cycle(w);
  const titles = w.fake.sceneEvents.map((e) => e.data.title);
  assert.equal(titles.length, 11);
  assert.ok(titles.includes('Alerte crue'));
});

test('a list suddenly empty is refused: the copy on disk keeps serving', async (t) => {
  const site = createSite();
  const clock = createClock();
  const first = await world(t, { site, clock });
  await first.app.stop();
  site.emitters = [];
  clock.advance(25 * 60 * 60 * 1000);
  const second = await world(t, { site, clock, dataDir: first.dataDir });
  assert.equal(second.fake.discoveredDevices.length, 20);
  assert.equal(second.fake.connectionStatus.message, undefined);
});

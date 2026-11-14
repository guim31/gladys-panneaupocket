// -----------------------------------------------------------------------------
// What the integration writes to `docker logs`: at info, only the lifecycle
// (the start, a page lost and back, a configuration saved), never one line per
// cycle nor per new message; a failure that repeats at every cycle is logged
// once, plus one line when it is over.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { NAILLY, captureLogs, create, createWorld, cycle } from './helpers/world.js';

const strip = (line) => line.text.replace(/^\[[^\]]+\] /, '');

async function world(t) {
  const w = await createWorld({ config: { search: '89100' } });
  t.after(() => w.app.stop());
  return w;
}

test('the start is one info line', async (t) => {
  const lines = captureLogs(t, 'info');
  await world(t);
  assert.deepEqual(lines.map(strip), [
    '[INFO] [panneaupocket] Started: 0 emitter(s) followed, read every 30 min',
  ]);
});

test('normal cycles write nothing at info, new messages included', async (t) => {
  const w = await world(t);
  await create(w, NAILLY);
  const lines = captureLogs(t, 'info');
  w.site.publish(NAILLY, { messageId: '700', title: 'Nouveau' });
  for (let i = 0; i < 4; i += 1) {
    await cycle(w);
  }
  assert.equal(w.fake.sceneEvents.length, 1);
  assert.deepEqual(lines, []);
});

test('a page down is one line, however long, and one line when back', async (t) => {
  const w = await world(t);
  await create(w, NAILLY);
  const lines = captureLogs(t, 'info');
  w.site.down = 503;
  for (let i = 0; i < 3; i += 1) {
    await cycle(w);
  }
  w.site.down = false;
  await cycle(w);
  await cycle(w);
  assert.deepEqual(lines.map(strip), [
    `[WARN] [panneaupocket] Page of emitter ${NAILLY} unreachable: PanneauPocket answered HTTP 503`,
    `[INFO] [panneaupocket] Page of emitter ${NAILLY} read again`,
  ]);
});

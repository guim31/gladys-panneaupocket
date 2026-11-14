// -----------------------------------------------------------------------------
// The `messages` widget, validated against the core's content vocabulary
// (`validateWidgetContent`), with one emitter, all of them, and none.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateWidgetContent } from '@gladysassistant/integration-sdk';
import { WIDGET_KEY } from '../src/monitor.js';
import { MAX_ITEMS } from '../src/widgets.js';
import { NAILLY, TIGY, create, createWorld } from './helpers/world.js';

async function world(t) {
  const w = await createWorld({ config: { search: `${NAILLY}, ${TIGY}` } });
  t.after(() => w.app.stop());
  return w;
}

const get = async (w, settings = {}, language = 'fr') => {
  const { data } = await w.fake.widgetGet(WIDGET_KEY, { settings, language });
  assert.deepEqual(validateWidgetContent(data.content), []);
  return data.content;
};

const textsOf = (content) => content.components.filter((c) => c.type === 'text').map((c) => c.text);

test('no emitter added yet', async (t) => {
  const w = await world(t);
  const content = await get(w);
  assert.deepEqual(textsOf(content), ['Aucun émetteur ajouté', 'Source : PanneauPocket']);
});

test('one emitter: its name in Gladys, alerts first, the whole text in the panel', async (t) => {
  const w = await world(t);
  const device = await create(w, NAILLY);
  const content = await get(w, { emitter: device.external_id });
  assert.equal(textsOf(content)[0], 'Nailly (89100) · 15 messages');
  const list = content.components.find((c) => c.type === 'card-list');
  assert.equal(list.items.length, MAX_ITEMS);
  assert.deepEqual(
    list.items.slice(0, 3).map((item) => item.badge.text),
    ['Alerte', 'Alerte', 'Information'],
  );
  assert.equal(list.items[0].title, 'APPEL À LA VIGILANCE');
  assert.equal(list.items[0].subtitle, '12/11');
  assert.match(list.items[0].description, /Deux individus suspects/);
  assert.match(list.items[0].links[0].url, /\/ville\/1764110563-/);
  const button = content.components.find((c) => c.type === 'button');
  assert.equal(button.link.url, list.items[0].links[0].url);
  // Renamed in Gladys: the widget follows.
  await w.fake.deviceUpdated({ ...device, name: 'Ma mairie' });
  assert.equal(
    textsOf(await get(w, { emitter: device.external_id }))[0],
    'Ma mairie · 15 messages',
  );
});

test('several emitters: the emitter in the subtitle; the button can be hidden', async (t) => {
  const w = await world(t);
  await create(w, NAILLY);
  await create(w, TIGY);
  const content = await get(w, { show_button: false }, 'de');
  assert.equal(textsOf(content)[0], '38 Meldungen');
  const list = content.components.find((c) => c.type === 'card-list');
  assert.ok(list.items.every((item) => / · (Nailly|Tigy)/.test(item.subtitle)));
  assert.equal(
    content.components.some((c) => c.type === 'button'),
    false,
  );
});

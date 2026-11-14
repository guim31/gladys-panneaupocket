// -----------------------------------------------------------------------------
// The PanneauPocket client against the pages and the list recorded on
// 14/11/2026: what the page gives (ids, kinds, dates, titles, texts), the
// search of the configuration, and the HTTP failures.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSearch } from '../src/config.js';
import { Directory } from '../src/emitters.js';
import {
  HttpError,
  USER_AGENT,
  fetchMessages,
  htmlToText,
  pageUrl,
  parseDateLine,
  parseEmitters,
  parsePage,
} from '../src/panneaupocket.js';
import { Store } from '../src/store.js';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { NAILLY, TIGY, createSite, emptyPage, fixture } from './helpers/world.js';

test('a page gives its messages: id, kind, date line, title and text', () => {
  const messages = parsePage(fixture('nailly-2026-11-14.html'));
  assert.equal(messages.length, 15);
  assert.equal(new Set(messages.map((m) => m.id)).size, 15);
  const [first] = messages;
  assert.equal(first.id, '1731511941');
  assert.equal(first.type, 'alert');
  assert.equal(first.title, 'APPEL À LA VIGILANCE');
  assert.equal(first.dateLine, 'Alerte modifiée le 12/11/2026');
  assert.equal(first.published, '2026-11-12');
  assert.match(first.text, /^Alerte du 12\/11\/2026 à 17:09\nATTENTION !!!\nDeux individus/);
  assert.doesNotMatch(first.text, /<|&amp;|\ufeff/);
  assert.equal(messages.filter((m) => m.type === 'alert').length, 2);
});

test('events keep their days, pictures their link', () => {
  const messages = parsePage(fixture('tigy-2026-11-14.html'));
  assert.equal(messages.length, 23);
  const events = messages.filter((m) => m.type === 'event');
  assert.equal(events.length, 3);
  const fair = events.find((m) => m.title === 'VIDE-GRENIERS');
  assert.deepEqual(
    [fair.dateLine, fair.published, fair.from, fair.to],
    ['Le 29/11/2026', null, '2026-11-29', '2026-11-29'],
  );
  assert.match(fair.image, /^https:\/\/.+\/sign_image\//);
  assert.ok(messages.every((m) => m.title !== '' || m.text !== ''));
});

test('the date lines of the site', () => {
  assert.deepEqual(parseDateLine('Info publiée le 05/11/2026'), {
    published: '2026-11-05',
    from: null,
    to: null,
  });
  assert.deepEqual(parseDateLine('Du 04/12/2026 au 05/12/2026'), {
    published: null,
    from: '2026-12-04',
    to: '2026-12-05',
  });
  assert.deepEqual(parseDateLine("Jusqu'au 30/11/2026"), {
    published: null,
    from: null,
    to: '2026-11-30',
  });
  assert.deepEqual(parseDateLine(''), { published: null, from: null, to: null });
});

test('the rich text becomes plain lines', () => {
  assert.equal(
    htmlToText(
      '<p>Bonjour&nbsp;<strong>à tous</strong></p><p><br /></p><ul><li>un</li><li>deux &amp; trois</li></ul>',
    ),
    'Bonjour à tous\n• un\n• deux & trois',
  );
});

test('a page without message gives none', () => {
  assert.deepEqual(parsePage(emptyPage()), []);
});

test('the list of emitters is reduced to what the search needs', () => {
  const emitters = parseEmitters(fixture('emitters-2026-11-14.json'));
  assert.equal(emitters.length, 41);
  const nailly = emitters.find((emitter) => emitter.id === NAILLY);
  assert.deepEqual(nailly, {
    id: NAILLY,
    name: 'Nailly',
    postCode: '89100',
    city: 'Nailly',
    link: 'https://app.panneaupocket.com/ville/1764110563-nailly-89100',
  });
  assert.throws(() => parseEmitters('{"error":1}'), HttpError);
});

test('a page address without its list entry is built from the id', () => {
  assert.equal(pageUrl('42', null), 'https://app.panneaupocket.com/ville/42-panneau');
  assert.equal(
    pageUrl('42', 'https://evil.example/ville/42-x'),
    'https://app.panneaupocket.com/ville/42-panneau',
  );
});

test('the search: postcodes, names, ids and page addresses', async () => {
  const site = createSite();
  const directory = new Directory({
    store: new Store(mkdtempSync(join(tmpdir(), 'gladys-panneaupocket-')), 'emitters.json'),
    fetch: site.fetch,
    now: () => 0,
  });
  assert.equal(await directory.ensure(), true);
  const names = (text) => directory.search(parseSearch(text), 60).emitters.map((e) => e.name);
  assert.equal(names('89100').length, 19);
  assert.deepEqual(names('tigy'), ['Tigy']);
  assert.deepEqual(names('Saint Denis les Sens'), ['Saint-Denis-lès-Sens']);
  assert.deepEqual(names('sens'), ['Gendarmerie COB de Sens', 'Saint-Denis-lès-Sens']);
  assert.deepEqual(names(`https://app.panneaupocket.com/ville/${TIGY}-tigy-45510`), ['Tigy']);
  assert.deepEqual(names(NAILLY), ['Nailly']);
  const found = directory.search(parseSearch('89100, Atlantis'), 5);
  assert.equal(found.emitters.length, 5);
  assert.equal(found.truncated, true);
  assert.deepEqual(found.unmatched, ['Atlantis']);
  // The list is read once a day at most.
  await directory.ensure();
  assert.equal(site.requests.length, 1);
});

test('fetchMessages sends an honest User-Agent, and says 404 for an unknown emitter', async () => {
  const site = createSite();
  const seen = [];
  const fetchImpl = (url, init) => {
    seen.push(init.headers['User-Agent']);
    return site.fetch(url);
  };
  assert.equal((await fetchMessages(fetchImpl, { id: NAILLY })).length, 15);
  assert.deepEqual(seen, [USER_AGENT]);
  await assert.rejects(fetchMessages(fetchImpl, { id: '123456789' }), { status: 404 });
  site.down = 'network';
  await assert.rejects(fetchMessages(fetchImpl, { id: NAILLY }), {
    name: 'HttpError',
    status: null,
  });
  site.down = false;
  site.pages[NAILLY] = '<html><body>Maintenance</body></html>';
  await assert.rejects(fetchMessages(fetchImpl, { id: NAILLY }), /without messages/);
});

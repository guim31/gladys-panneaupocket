// -----------------------------------------------------------------------------
// Dashboard widget (manifest `widgets`, Gladys 5.1+): `messages`.
//
// A heading (the emitter's name in Gladys, or the number of messages), then
// the messages as a `card-list` (8 rows at most, the core's cap): alerts
// first, then the newest. A row shows the date and, when several emitters are
// shown, the emitter; tapping it opens the core's detail panel with the whole
// text and links to the page and to the picture. The footer gives the source
// and the time of the last reading, and a button to the page (hideable).
// Settings: `emitter` (one followed emitter, all when empty), `show_button`.
// Budget: 2 texts, 1 card-list, 1 button.
// -----------------------------------------------------------------------------

import { emitterIdOf } from './device.js';
import { TYPE_COLORS, TYPE_NAMES, clip, formatIsoDay, formatTime, titleOf } from './messages.js';
import { WIDGET_KEY } from './monitor.js';
import { SITE_URL } from './panneaupocket.js';

export const MAX_ITEMS = 8;
export const TTL_SECONDS = 900;

export const TEXT = {
  waiting: {
    en: 'Waiting for PanneauPocket…',
    fr: 'En attente de PanneauPocket…',
    de: 'Warte auf PanneauPocket…',
    es: 'Esperando a PanneauPocket…',
  },
  noEmitter: {
    en: 'No emitter added',
    fr: 'Aucun émetteur ajouté',
    de: 'Kein Absender hinzugefügt',
    es: 'Ningún emisor añadido',
  },
  none: { en: 'No message', fr: 'Aucun message', de: 'Keine Meldung', es: 'Ningún mensaje' },
  one: { en: '1 message', fr: '1 message', de: '1 Meldung', es: '1 mensaje' },
  many: { en: ' messages', fr: ' messages', de: ' Meldungen', es: ' mensajes' },
  source: {
    en: 'Source: PanneauPocket',
    fr: 'Source : PanneauPocket',
    de: 'Quelle: PanneauPocket',
    es: 'Fuente: PanneauPocket',
  },
  page: {
    en: 'PanneauPocket page',
    fr: 'Page PanneauPocket',
    de: 'PanneauPocket-Seite',
    es: 'Página PanneauPocket',
  },
  picture: { en: 'Picture', fr: 'Image', de: 'Bild', es: 'Imagen' },
};

const t = (text, language) => text[language] ?? text.en;

function count(messages, language) {
  if (messages.length === 0) {
    return t(TEXT.none, language);
  }
  return messages.length === 1
    ? t(TEXT.one, language)
    : `${messages.length}${t(TEXT.many, language)}`;
}

/** One row of the list, and its detail panel. */
export function itemOf(message, emitter, language, { showEmitter }) {
  const links = [{ url: emitter.link, label: t(TEXT.page, language) }];
  if (message.image) {
    links.push({ url: message.image, label: t(TEXT.picture, language) });
  }
  const when = message.day ? formatIsoDay(message.day, language) : message.dateLine;
  return {
    title: clip(titleOf(message), 60),
    subtitle: clip([when, showEmitter ? emitter.name : null].filter(Boolean).join(' · '), 60),
    badge: { text: TYPE_NAMES[language][message.type], color: TYPE_COLORS[message.type] },
    // Written by the emitter, in French: shown as it is.
    description: clip([message.dateLine, message.text].filter(Boolean).join('\n\n'), 2000),
    links,
  };
}

export const WIDGETS = {
  [WIDGET_KEY]: {
    async get(monitor, { settings = {}, language = 'en' } = {}) {
      const lang = TYPE_NAMES[language] ? language : 'en';
      const only = settings.emitter ? emitterIdOf(monitor.gladys, settings.emitter) : null;
      const emitters = monitor.followed().filter((emitter) => !only || emitter.id === only);
      const read = emitters.filter((emitter) => monitor.pages.has(emitter.id));
      const rows = read
        .flatMap((emitter) =>
          monitor.messagesOf(emitter.id).map((message) => ({ message, emitter })),
        )
        .sort(
          (a, b) =>
            (b.message.type === 'alert') - (a.message.type === 'alert') ||
            (b.message.day ?? '').localeCompare(a.message.day ?? '') ||
            a.message.index - b.message.index,
        );
      let heading;
      if (emitters.length === 0) {
        heading = t(TEXT.noEmitter, lang);
      } else if (read.length === 0) {
        heading = t(TEXT.waiting, lang);
      } else if (emitters.length === 1) {
        heading = `${emitters[0].name} · ${count(rows, lang)}`;
      } else {
        heading = count(rows, lang);
      }
      const components = [{ type: 'text', variant: 'heading', text: clip(heading, 120) }];
      if (rows.length > 0) {
        components.push({
          type: 'card-list',
          display: 'list',
          items: rows
            .slice(0, MAX_ITEMS)
            .map(({ message, emitter }) =>
              itemOf(message, emitter, lang, { showEmitter: emitters.length > 1 }),
            ),
        });
      }
      const readAt = Math.max(...read.map((emitter) => monitor.pages.get(emitter.id).readAt));
      const source = t(TEXT.source, lang);
      components.push({
        type: 'text',
        variant: 'caption',
        text: read.length > 0 ? `${source} · ${formatTime(readAt, lang)}` : source,
      });
      if (settings.show_button !== false) {
        components.push({
          type: 'button',
          label: t(TEXT.page, lang),
          icon: 'external-link',
          link: { url: emitters.length === 1 ? emitters[0].link : SITE_URL },
        });
      }
      return { ttl_seconds: TTL_SECONDS, components };
    },
  },
};

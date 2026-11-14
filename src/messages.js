// -----------------------------------------------------------------------------
// Texts sent from the container (feature values, connection status, scene
// variables and outputs, widget), in the four languages of the Gladys
// interface. Entries are strings or functions of one parameter object. German
// says "du", Spanish "usted". The messages themselves come from PanneauPocket
// as their emitters wrote them, in French: they are not translated.
// -----------------------------------------------------------------------------

import { WIDGET_COLORS } from '@gladysassistant/integration-sdk';
import { LANGUAGES } from './config.js';

// The kinds of message PanneauPocket shows. Short enough for a widget badge
// (16 characters).
export const TYPE_NAMES = {
  en: { info: 'Information', alert: 'Alert', event: 'Event' },
  fr: { info: 'Information', alert: 'Alerte', event: 'Événement' },
  de: { info: 'Information', alert: 'Warnung', event: 'Veranstaltung' },
  es: { info: 'Información', alert: 'Alerta', event: 'Evento' },
};

export const TYPE_COLORS = {
  info: WIDGET_COLORS.PRIMARY,
  alert: WIDGET_COLORS.DANGER,
  event: WIDGET_COLORS.SUCCESS,
};

// Values of the "Latest message" feature, and pieces of sentences.
export const PHRASES = {
  en: {
    none: 'No message',
    summary: ({ emitter, type, title }) => `${emitter}, ${type}: ${title}`,
    count: ({ count, alerts }) =>
      `${count === 1 ? '1 message' : `${count} messages`}${alerts > 0 ? `, including ${alerts === 1 ? '1 alert' : `${alerts} alerts`}` : ''}`,
    noMessage: 'No message on PanneauPocket.',
    list: ({ head, items }) => `${head}: ${items.join('; ')}.`,
    more: ({ count }) => `and ${count} more`,
    emitterHead: ({ emitter, text }) => `${emitter}: ${text}`,
  },
  fr: {
    none: 'Aucun message',
    summary: ({ emitter, type, title }) => `${emitter}, ${type} : ${title}`,
    count: ({ count, alerts }) =>
      `${count === 1 ? '1 message' : `${count} messages`}${alerts > 0 ? `, dont ${alerts === 1 ? '1 alerte' : `${alerts} alertes`}` : ''}`,
    noMessage: 'Aucun message sur PanneauPocket.',
    list: ({ head, items }) => `${head} : ${items.join(' ; ')}.`,
    more: ({ count }) => `et ${count} de plus`,
    emitterHead: ({ emitter, text }) => `${emitter} : ${text}`,
  },
  de: {
    none: 'Keine Meldung',
    summary: ({ emitter, type, title }) => `${emitter}, ${type}: ${title}`,
    count: ({ count, alerts }) =>
      `${count === 1 ? '1 Meldung' : `${count} Meldungen`}${alerts > 0 ? `, davon ${alerts === 1 ? '1 Warnung' : `${alerts} Warnungen`}` : ''}`,
    noMessage: 'Keine Meldung auf PanneauPocket.',
    list: ({ head, items }) => `${head}: ${items.join('; ')}.`,
    more: ({ count }) => `und ${count} weitere`,
    emitterHead: ({ emitter, text }) => `${emitter}: ${text}`,
  },
  es: {
    none: 'Ningún mensaje',
    summary: ({ emitter, type, title }) => `${emitter}, ${type}: ${title}`,
    count: ({ count, alerts }) =>
      `${count === 1 ? '1 mensaje' : `${count} mensajes`}${alerts > 0 ? `, de ellos ${alerts === 1 ? '1 alerta' : `${alerts} alertas`}` : ''}`,
    noMessage: 'Ningún mensaje en PanneauPocket.',
    list: ({ head, items }) => `${head}: ${items.join('; ')}.`,
    more: ({ count }) => `y ${count} más`,
    emitterHead: ({ emitter, text }) => `${emitter}: ${text}`,
  },
};

// Connection status of the Configuration screen.
export const STATUS = {
  en: {
    initFailed: 'Initialization failed, check the integration logs.',
    listDown: 'The list of PanneauPocket emitters cannot be read: the search is not available.',
    unmatched: ({ values }) => `No emitter found for: ${values}.`,
    truncated: ({ max }) => `Too many emitters found: only the first ${max} are offered.`,
    pagesDown: ({ names }) => `PanneauPocket does not answer for: ${names}.`,
    notFound: ({ names }) => `No longer on PanneauPocket: ${names}.`,
  },
  fr: {
    initFailed: "L'initialisation a échoué, consultez les logs de l'intégration.",
    listDown: 'La liste des émetteurs PanneauPocket est illisible : la recherche est indisponible.',
    unmatched: ({ values }) => `Aucun émetteur trouvé pour : ${values}.`,
    truncated: ({ max }) => `Trop d'émetteurs trouvés : seuls les ${max} premiers sont proposés.`,
    pagesDown: ({ names }) => `PanneauPocket ne répond pas pour : ${names}.`,
    notFound: ({ names }) => `N'est plus sur PanneauPocket : ${names}.`,
  },
  de: {
    initFailed: 'Initialisierung fehlgeschlagen, sieh dir die Protokolle der Integration an.',
    listDown:
      'Die Liste der PanneauPocket-Absender ist nicht lesbar: Die Suche ist nicht verfügbar.',
    unmatched: ({ values }) => `Kein Absender gefunden für: ${values}.`,
    truncated: ({ max }) => `Zu viele Absender gefunden: Nur die ersten ${max} werden angeboten.`,
    pagesDown: ({ names }) => `PanneauPocket antwortet nicht für: ${names}.`,
    notFound: ({ names }) => `Nicht mehr auf PanneauPocket: ${names}.`,
  },
  es: {
    initFailed: 'La inicialización ha fallado, consulte los registros de la integración.',
    listDown:
      'La lista de emisores de PanneauPocket no se puede leer: la búsqueda no está disponible.',
    unmatched: ({ values }) => `Ningún emisor encontrado para: ${values}.`,
    truncated: ({ max }) => `Demasiados emisores encontrados: solo se ofrecen los ${max} primeros.`,
    pagesDown: ({ names }) => `PanneauPocket no responde para: ${names}.`,
    notFound: ({ names }) => `Ya no está en PanneauPocket: ${names}.`,
  },
};

/** One entry of a message table, in every language: `{ en, fr, de, es }`. */
export function render(table, key, params = {}) {
  return Object.fromEntries(
    LANGUAGES.map((language) => {
      const entry = table[language][key];
      return [language, typeof entry === 'function' ? entry(params) : entry];
    }),
  );
}

/** Several multi-language texts joined, language by language. */
export function join(...messages) {
  return Object.fromEntries(
    LANGUAGES.map((language) => [
      language,
      messages
        .filter(Boolean)
        .map((message) => message[language])
        .join(' '),
    ]),
  );
}

const locale = (language) => (language === 'en' ? 'en-GB' : language);

/** A calendar day "2026-11-12" as "12/11" ("12.11." in German). */
export function formatIsoDay(day, language) {
  return new Intl.DateTimeFormat(locale(language), {
    day: '2-digit',
    month: '2-digit',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00Z`));
}

/** A time of day in the time zone of Gladys (TZ), e.g. "18:35". */
export function formatTime(time, language) {
  return new Intl.DateTimeFormat(locale(language), { hour: '2-digit', minute: '2-digit' }).format(
    new Date(time),
  );
}

/** The calendar day of a time in the time zone of Gladys, "2026-11-14". */
export function localDay(time) {
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(time));
}

export const clip = (text, max) => (text.length <= max ? text : `${text.slice(0, max - 1)}…`);

/** The title of a message, or the start of its text for a message without one. */
export function titleOf(message) {
  return message.title || clip(message.text.split('\n')[0] ?? '', 80) || '—';
}

/** The value of the "Latest message" feature: "12/11 · APPEL À LA VIGILANCE". */
export function describe(message, language) {
  const title = titleOf(message);
  return clip(message.day ? `${formatIsoDay(message.day, language)} · ${title}` : title, 200);
}

// Messages named in one sentence: a scene that reads it aloud stays short.
export const SENTENCE_MESSAGES = 5;

/** The messages of one emitter as one sentence, alerts first. */
export function sentence(messages, language) {
  const p = PHRASES[language];
  if (messages.length === 0) {
    return p.noMessage;
  }
  const alerts = messages.filter((message) => message.type === 'alert').length;
  const items = messages.slice(0, SENTENCE_MESSAGES).map(titleOf);
  const rest = messages.length - SENTENCE_MESSAGES;
  if (rest > 0) {
    items.push(p.more({ count: rest }));
  }
  return p.list({ head: p.count({ count: messages.length, alerts }), items });
}

// -----------------------------------------------------------------------------
// The scene action `read_messages`: the current messages of one followed
// emitter (or of all of them) as one sentence, alerts counted apart: something
// a scene can send by message or read aloud. The pages are read again when
// the last reading is older than one interval.
// -----------------------------------------------------------------------------

import { emitterIdOf } from './device.js';
import { PHRASES, sentence } from './messages.js';

export const SCENE_ACTION = 'read_messages';

const ERRORS = {
  en: 'No PanneauPocket page could be read.',
  fr: "Aucune page PanneauPocket n'a pu être lue.",
  de: 'Keine PanneauPocket-Seite konnte gelesen werden.',
  es: 'No se ha podido leer ninguna página de PanneauPocket.',
};
export const ACTION_TEXTS = { error: ERRORS };

/** Scene action: outputs `text`, `count` and `alert_count`. */
export async function readMessages(monitor, fields = {}) {
  const language = monitor.config.language;
  const only = fields.emitter ? emitterIdOf(monitor.gladys, fields.emitter) : null;
  if (fields.emitter && !only) {
    throw new Error(ERRORS[language]);
  }
  const emitters = (await monitor.fresh(only)).filter((emitter) => monitor.pages.has(emitter.id));
  if (emitters.length === 0) {
    throw new Error(ERRORS[language]);
  }
  const all = emitters.flatMap((emitter) => monitor.messagesOf(emitter.id));
  const text =
    emitters.length === 1
      ? sentence(all, language)
      : emitters
          .map((emitter) =>
            PHRASES[language].emitterHead({
              emitter: emitter.name,
              text: sentence(monitor.messagesOf(emitter.id), language),
            }),
          )
          .join(' ');
  return {
    text,
    count: all.length,
    alert_count: all.filter((message) => message.type === 'alert').length,
  };
}

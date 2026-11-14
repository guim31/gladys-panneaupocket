// -----------------------------------------------------------------------------
// One Gladys device per followed emitter (a town hall, a grouping of
// communes, a school, a gendarmerie…).
//
// Features (couples checked against the Gladys front, see
// test/gladys-rules.test.js):
//   - messages        counter-sensor/integer: messages on the emitter's page;
//   - alerts          counter-sensor/integer: those of them marked "alert";
//   - latest_message  text/text: the newest one, with its date. The core has
//                     no date type: the date of the latest message is there.
//
// Published with should_poll: false: the pages are read by the monitor's own
// timer (src/monitor.js). The platform id is the PanneauPocket id of the
// emitter, which never changes (its name and its page address can).
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES,
  DEVICE_FEATURE_TYPES as TYPES,
} from '@gladysassistant/integration-sdk';

export const DEVICE_TYPE = 'emitter';
export const FEATURE_KEYS = {
  MESSAGES: 'messages',
  ALERTS: 'alerts',
  LATEST: 'latest_message',
};
export const MAX_COUNT = 1000;

// Feature names, frozen at creation in Gladys (language of the configuration).
export const NAMES = {
  en: { messages: 'Current messages', alerts: 'Current alerts', latest_message: 'Latest message' },
  fr: {
    messages: 'Messages en cours',
    alerts: 'Alertes en cours',
    latest_message: 'Dernier message',
  },
  de: {
    messages: 'Aktuelle Meldungen',
    alerts: 'Aktuelle Warnungen',
    latest_message: 'Neueste Meldung',
  },
  es: {
    messages: 'Mensajes actuales',
    alerts: 'Alertas actuales',
    latest_message: 'Último mensaje',
  },
};

/** External ids of an emitter's device and of its features. */
export function deviceIds(gladys, emitterId) {
  const ids = gladys.externalIds(DEVICE_TYPE, String(emitterId));
  return {
    device: ids.device,
    messages: ids.feature(FEATURE_KEYS.MESSAGES),
    alerts: ids.feature(FEATURE_KEYS.ALERTS),
    latest: ids.feature(FEATURE_KEYS.LATEST),
  };
}

/** The PanneauPocket id of one of our devices, from its external id; null for another one. */
export function emitterIdOf(gladys, externalId) {
  const prefix = gladys.externalIds(DEVICE_TYPE, '0').device.slice(0, -1);
  if (typeof externalId !== 'string' || !externalId.startsWith(prefix)) {
    return null;
  }
  const id = externalId.slice(prefix.length);
  return /^\d+$/.test(id) ? id : null;
}

/** "Nailly (89100)": the postcode tells apart the emitters of the same name. */
export function deviceName(emitter) {
  const name = emitter.name || emitter.id;
  const full =
    emitter.postCode && !name.includes(emitter.postCode) ? `${name} (${emitter.postCode})` : name;
  return full.length <= 80 ? full : `${full.slice(0, 79)}…`;
}

const sensor = (name, externalId, category, type, extra) => ({
  name,
  external_id: externalId,
  category,
  type,
  read_only: true,
  has_feedback: false,
  ...extra,
});

const counter = (name, externalId) =>
  sensor(name, externalId, DEVICE_FEATURE_CATEGORIES.COUNTER_SENSOR, TYPES.SENSOR.INTEGER, {
    keep_history: true,
    min: 0,
    max: MAX_COUNT,
  });

/** The discovery payload of an emitter's device. */
export function buildDevice(gladys, emitter, language = 'fr') {
  const ids = deviceIds(gladys, emitter.id);
  const names = NAMES[language] ?? NAMES.fr;
  return {
    name: deviceName(emitter),
    external_id: ids.device,
    model: 'PanneauPocket',
    should_poll: false,
    params: [{ name: 'page', value: emitter.link }],
    features: [
      counter(names.messages, ids.messages),
      counter(names.alerts, ids.alerts),
      sensor(names.latest_message, ids.latest, DEVICE_FEATURE_CATEGORIES.TEXT, TYPES.TEXT.TEXT, {
        keep_history: true,
        min: 0,
        max: 0,
      }),
    ],
  };
}

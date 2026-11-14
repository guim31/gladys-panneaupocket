// -----------------------------------------------------------------------------
// Integration configuration: defaults (they mirror the `default` values of the
// manifest `config_schema`, see test/manifest.test.js) and normalization, so
// the rest of the code never deals with strings, blanks or `undefined`.
// -----------------------------------------------------------------------------

export const LANGUAGES = ['en', 'fr', 'de', 'es'];

// Minutes between two readings of each followed page: the brief of the
// project asks for 15 to 30 minutes, an hour suits a quiet village.
export const REFRESH_INTERVALS = ['15', '30', '60'];

// Search terms kept, and emitters offered in the Discover tab: a search for
// a large town or a département-wide grouping must not flood the list.
export const MAX_TERMS = 20;
export const MAX_DISCOVERED = 60;

export const DEFAULT_CONFIG = {
  search: '',
  refresh_interval: '30',
  language: 'fr',
};

/** Lower case, without accents nor punctuation: "Saint-Denis-lès-Sens" → "saint denis les sens". */
export function fold(text) {
  return String(text ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/**
 * Search terms, separated by commas, semicolons or new lines. Each is
 * `{ kind: 'id' | 'postcode' | 'name', value, raw }`: the address of a page
 * (or a bare id of 6 digits or more), a postcode of 5 digits, or a name.
 */
export function parseSearch(text) {
  const terms = [];
  for (const part of String(text ?? '').split(/[,;\n]+/)) {
    const raw = part.trim();
    if (raw === '') {
      continue;
    }
    const link = /\/(?:ville|embeded)\/(\d+)/.exec(raw);
    let term;
    if (link) {
      term = { kind: 'id', value: link[1], raw };
    } else if (/^\d{5}$/.test(raw)) {
      term = { kind: 'postcode', value: raw, raw };
    } else if (/^\d{6,}$/.test(raw)) {
      term = { kind: 'id', value: String(Number(raw)), raw };
    } else {
      const value = fold(raw);
      if (value.length < 2) {
        continue;
      }
      term = { kind: 'name', value, raw };
    }
    if (!terms.some((other) => other.kind === term.kind && other.value === term.value)) {
      terms.push(term);
    }
  }
  return terms.slice(0, MAX_TERMS);
}

/**
 * @param {Record<string, unknown>} raw the configuration returned by the SDK
 */
export function normalizeConfig(raw = {}) {
  const source = raw && typeof raw === 'object' ? raw : {};
  const refresh = String(source.refresh_interval ?? '');
  return {
    terms: parseSearch(source.search),
    refreshMinutes: Number(
      REFRESH_INTERVALS.includes(refresh) ? refresh : DEFAULT_CONFIG.refresh_interval,
    ),
    language: LANGUAGES.includes(source.language) ? source.language : DEFAULT_CONFIG.language,
  };
}

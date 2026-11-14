// -----------------------------------------------------------------------------
// PanneauPocket client. PanneauPocket has no documented API: the integration
// reads what anyone can read without an account, with an honest User-Agent and
// no browser imitation.
//
//   - The emitters (town halls, groupings of communes, schools, gendarmerie…):
//     `GET /public-api/city`, the JSON the site's own search uses (about 16,000
//     entries, 6.5 MB, measured on 14/11/2026). Read at most once a day and kept
//     under /data (src/emitters.js).
//   - The messages of one emitter: its public page `/ville/<id>-<slug>`, HTML.
//     The site loads no JSON for it: the messages are in the page itself, one
//     `sign-carousel--item` block each, with a stable `data-id`, a type icon
//     (`/build/images/sign/<info|alert|event>.<hash>.svg`), a date line
//     ("Info publiée le 13/11/2026", "Alerte modifiée le 12/11/2026",
//     "Le 29/11/2026", "Du 01/12/2026 au 05/12/2026", "Jusqu'au 30/11/2026"), a
//     title and the text as HTML. A wrong slug is redirected to the right one;
//     an unknown id is a 404.
// The page can change at any time: what this file parses is pinned by the
// recorded pages of test/fixtures/panneaupocket.
// -----------------------------------------------------------------------------

export const SITE_URL = 'https://app.panneaupocket.com';
export const EMITTERS_URL = `${SITE_URL}/public-api/city`;
export const USER_AGENT =
  'gladys-panneaupocket (Gladys Assistant integration; +https://github.com/guim31/gladys-panneaupocket)';

export const TYPES = ['info', 'alert', 'event'];
export const MIN_EMITTERS = 20;

export class HttpError extends Error {
  /**
   * @param {string} message
   * @param {number|null} status HTTP status, null for a network error
   */
  constructor(message, status = null) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** GET `url` and return its body as text. */
async function getText(fetchImpl, url, { accept, timeoutMs }) {
  let response;
  try {
    response = await fetchImpl(url, {
      headers: { Accept: accept, 'User-Agent': USER_AGENT },
      redirect: 'follow',
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (err) {
    const reason = err?.name === 'TimeoutError' ? 'timeout' : (err?.cause?.code ?? err.message);
    throw new HttpError(`PanneauPocket unreachable (${reason})`);
  }
  if (response.status !== 200) {
    throw new HttpError(`PanneauPocket answered HTTP ${response.status}`, response.status);
  }
  return response.text();
}

/** The page of an emitter: the link of the list, or one built from its id (redirected). */
export function pageUrl(id, link) {
  if (typeof link === 'string' && link.startsWith(`${SITE_URL}/ville/${id}-`)) {
    return link;
  }
  return `${SITE_URL}/ville/${id}-panneau`;
}

// --- Emitters -------------------------------------------------------------------

/**
 * The emitters, reduced to what the search and the pages need:
 * `[{ id, name, postCode, city, link }]`. Entries without an id are dropped.
 */
export function parseEmitters(body) {
  const list = typeof body === 'string' ? JSON.parse(body) : body;
  if (!Array.isArray(list)) {
    throw new HttpError('PanneauPocket sent an unexpected list of emitters');
  }
  const emitters = [];
  for (const entry of list) {
    const id = Number(entry?.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      continue;
    }
    emitters.push({
      id: String(id),
      name: clean(entry.name) || clean(entry.city) || String(id),
      postCode: clean(entry.postCode),
      city: clean(entry.city),
      link: pageUrl(id, entry.link),
    });
  }
  // A list this short is a site change or an incident, not the 16,000
  // emitters: refused, so the copy on disk keeps serving.
  if (emitters.length < MIN_EMITTERS) {
    throw new HttpError(`PanneauPocket sent a list of ${emitters.length} emitter(s)`);
  }
  return emitters;
}

export async function fetchEmitters(fetchImpl) {
  const body = await getText(fetchImpl, EMITTERS_URL, {
    accept: 'application/json',
    timeoutMs: 90000,
  });
  try {
    return parseEmitters(body);
  } catch (err) {
    if (err instanceof HttpError) {
      throw err;
    }
    throw new HttpError('PanneauPocket sent an unreadable list of emitters');
  }
}

// --- Messages -------------------------------------------------------------------

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code) => {
    if (code[0] === '#') {
      const point =
        code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}

/** One line of text: tags out, entities decoded, invisible characters and runs of spaces collapsed. */
export function clean(value) {
  if (typeof value !== 'string') {
    return '';
  }
  return decodeEntities(value.replace(/<[^>]*>/g, ' '))
    .replace(/[\u200b-\u200d\u2060\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** The rich text of a message (Quill HTML) as plain text, one paragraph a line. */
export function htmlToText(html) {
  const text = decodeEntities(
    html
      .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
      .replace(/<li[^>]*>/gi, '• ')
      .replace(/<[^>]*>/g, ''),
  ).replace(/[\u200b-\u200d\u2060\ufeff]/g, '');
  return text
    .split('\n')
    .map((line) => line.replace(/[ \t\u00a0]+/g, ' ').trim())
    .filter((line) => line !== '')
    .join('\n');
}

/** "13/11/2026" → "2026-11-13", or null. */
function isoDay(day, month, year) {
  const d = Number(day);
  const m = Number(month);
  if (d < 1 || d > 31 || m < 1 || m > 12) {
    return null;
  }
  return `${year}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/**
 * The date line of a message. `published`: the day of "publiée le" or
 * "modifiée le" (info and alert messages), else null. `from`/`to`: the days
 * of an event, when given.
 */
export function parseDateLine(line) {
  const days = [...line.matchAll(/(\d{1,2})\/(\d{1,2})\/(\d{4})/g)].map((m) =>
    isoDay(m[1], m[2], m[3]),
  );
  const published = /(publi|modifi)ée?s? le/i.test(line) ? (days[0] ?? null) : null;
  let from = null;
  let to = null;
  if (!published) {
    if (/^jusqu/i.test(line)) {
      to = days[0] ?? null;
    } else {
      from = days[0] ?? null;
      to = days[1] ?? days[0] ?? null;
    }
  }
  return { published, from, to };
}

const between = (text, start, end) => {
  const i = text.indexOf(start);
  if (i < 0) {
    return null;
  }
  const j = text.indexOf(end, i + start.length);
  return j < 0 ? text.slice(i + start.length) : text.slice(i + start.length, j);
};

/** The inner HTML of the first `<div class="<name>">`, its nested divs balanced. */
function divContent(html, className) {
  const open = new RegExp(`<div class="${className}"[^>]*>`).exec(html);
  if (!open) {
    return null;
  }
  let depth = 1;
  const tags = /<(\/?)div\b[^>]*>/g;
  tags.lastIndex = open.index + open[0].length;
  let tag;
  while ((tag = tags.exec(html))) {
    depth += tag[1] ? -1 : 1;
    if (depth === 0) {
      return html.slice(open.index + open[0].length, tag.index);
    }
  }
  return html.slice(open.index + open[0].length);
}

/**
 * The messages of an emitter page, in the order of the page:
 * `[{ id, type, title, text, dateLine, published, from, to, image }]`.
 * A block seen twice (the page repeats none today, but a carousel could) is
 * kept once.
 */
export function parsePage(html) {
  const blocks = html.split(/<div class="sign-carousel--item[^"]*"/).slice(1);
  const messages = [];
  const seen = new Set();
  for (const block of blocks) {
    const id = /^\s*data-id="(\d+)"/.exec(block)?.[1];
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    const icon = /\/build\/images\/sign\/([a-z]+)[.\w-]*\.svg/.exec(block)?.[1];
    const type = TYPES.includes(icon) ? icon : 'info';
    const dateLine = clean(between(block, 'class="date">', '</span>') ?? '');
    const content = divContent(block, 'sign-preview__content') ?? '';
    const title = clean(divContent(content, 'title') ?? '');
    const body = divContent(content, 'content') ?? '';
    const image = /<a\s[^>]*href="(https:\/\/[^"]+\/sign_image\/[^"]+)"/.exec(body)?.[1] ?? null;
    messages.push({
      id,
      type,
      title,
      text: htmlToText(body),
      dateLine,
      ...parseDateLine(dateLine),
      image: image ? decodeEntities(image) : null,
    });
  }
  return messages;
}

/** The messages of one emitter; throws an HttpError (status 404: unknown emitter). */
export async function fetchMessages(fetchImpl, emitter) {
  const html = await getText(fetchImpl, pageUrl(emitter.id, emitter.link), {
    accept: 'text/html',
    timeoutMs: 30000,
  });
  if (!html.includes('sign-carousel') && !html.includes('page-city')) {
    // Not an emitter page: a maintenance page, or the site changed.
    throw new HttpError('PanneauPocket sent a page without messages');
  }
  return parsePage(html);
}

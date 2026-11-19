// Parser mínimo de RSS/XML, sem dependências.
// Suficiente para os feeds que usamos (Google News, Google Trends e RSS comuns).

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text) {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity) => {
    if (entity[0] === '#') {
      const isHex = entity[1].toLowerCase() === 'x';
      const code = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10);
      return Number.isFinite(code) && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const tagRe = (tag, flags) =>
  new RegExp(`<${escapeRe(tag)}(?:\\s[^>]*)?>([\\s\\S]*?)</${escapeRe(tag)}>`, flags);

function unwrap(raw) {
  const value = raw.trim();
  const cdata = value.match(/^<!\[CDATA\[([\s\S]*?)\]\]>$/);
  return (cdata ? cdata[1] : decodeEntities(value)).trim();
}

/** Conteúdo bruto de todas as ocorrências de <tag>…</tag>. */
export function getBlocks(xml, tag) {
  return [...xml.matchAll(tagRe(tag, 'g'))].map((m) => m[1]);
}

/** Texto da primeira ocorrência de <tag>, com CDATA e entidades resolvidos. */
export function getText(xml, tag) {
  const match = xml.match(tagRe(tag));
  return match ? unwrap(match[1]) : '';
}

/** Valor de um atributo da primeira ocorrência de <tag ...>. */
export function getAttr(xml, tag, attr) {
  const re = new RegExp(`<${escapeRe(tag)}\\s[^>]*?\\b${escapeRe(attr)}="([^"]*)"`);
  const match = xml.match(re);
  return match ? decodeEntities(match[1]) : '';
}

export function stripHtml(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

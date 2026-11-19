import { createHash } from 'node:crypto';

export function hashId(value) {
  return createHash('sha1').update(String(value)).digest('hex').slice(0, 12);
}

export function toIso(dateText) {
  const date = new Date(dateText);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/**
 * Pontuação de "viralidade" de um vídeo: visualizações ponderadas pelo
 * engajamento, divididas pela idade (com "gravidade", como no Hacker News).
 * Um vídeo novo com muitas views por hora sobe mais que um antigo com muitas views no total.
 */
export function viralScore({ views = 0, likes = 0, comments = 0, publishedAt }, now = new Date()) {
  const published = new Date(publishedAt);
  const hours = Number.isNaN(published.getTime())
    ? 24
    : Math.max(0, (now.getTime() - published.getTime()) / 3_600_000);
  const weighted = views + likes * 10 + comments * 25;
  return Math.round(weighted / Math.pow(hours + 2, 1.3));
}

/** Converte "2000+", "20 mil+", "1,5 mi+", "50K+" em número aproximado. */
export function parseTraffic(text) {
  if (!text) return 0;
  const clean = text.toLowerCase().replace(/\+/g, '').trim();
  const match = clean.match(/([\d.,]+)\s*(k|mil|m|mi|mi\.|milhões|milhão)?/);
  if (!match) return 0;
  let number = match[1];
  // "1.500" (milhar pt-BR) vs "1,5" (decimal pt-BR) vs "1.5" (decimal en)
  if (/^\d{1,3}(\.\d{3})+$/.test(number)) number = number.replace(/\./g, '');
  number = parseFloat(number.replace(',', '.'));
  if (!Number.isFinite(number)) return 0;
  const unit = match[2] ?? '';
  if (unit === 'k' || unit === 'mil') return Math.round(number * 1_000);
  if (unit.startsWith('m')) return Math.round(number * 1_000_000);
  return Math.round(number);
}

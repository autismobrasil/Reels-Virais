import { getAttr, getBlocks, getText } from '../lib/xml.mjs';
import { hashId, toIso } from '../lib/util.mjs';

const BASE = 'https://news.google.com/rss';
const LOCALE = 'hl=pt-BR&gl=BR&ceid=BR:pt-419';

export const NEWS_CATEGORIES = [
  { id: 'destaques', label: 'Destaques', topic: null },
  { id: 'brasil', label: 'Brasil', topic: 'NATION' },
  { id: 'mundo', label: 'Mundo', topic: 'WORLD' },
  { id: 'economia', label: 'Economia', topic: 'BUSINESS' },
  { id: 'tecnologia', label: 'Tecnologia', topic: 'TECHNOLOGY' },
  { id: 'entretenimento', label: 'Entretenimento', topic: 'ENTERTAINMENT' },
  { id: 'esportes', label: 'Esportes', topic: 'SPORTS' },
  { id: 'ciencia', label: 'Ciência', topic: 'SCIENCE' },
  { id: 'saude', label: 'Saúde', topic: 'HEALTH' },
];

export function categoryUrl(topic) {
  return topic ? `${BASE}/headlines/section/topic/${topic}?${LOCALE}` : `${BASE}?${LOCALE}`;
}

export function parseGoogleNews(xml, categoryId) {
  return getBlocks(xml, 'item')
    .map((item) => {
      const source = getText(item, 'source');
      let title = getText(item, 'title');
      // O Google News anexa " - Nome da fonte" ao título.
      if (source && title.endsWith(` - ${source}`)) title = title.slice(0, -(source.length + 3));
      const url = getText(item, 'link');
      return {
        id: `n:${hashId(url)}`,
        type: 'news',
        title,
        url,
        source,
        sourceUrl: getAttr(item, 'source', 'url'),
        publishedAt: toIso(getText(item, 'pubDate')),
        categories: [categoryId],
      };
    })
    .filter((item) => item.title && item.url);
}

export async function fetchGoogleNews({ fetchText }) {
  const byId = new Map();
  const errors = [];
  for (const category of NEWS_CATEGORIES) {
    try {
      const xml = await fetchText(categoryUrl(category.topic));
      for (const item of parseGoogleNews(xml, category.id)) {
        const existing = byId.get(item.id);
        if (existing) {
          if (!existing.categories.includes(category.id)) existing.categories.push(category.id);
        } else {
          byId.set(item.id, item);
        }
      }
    } catch (error) {
      errors.push(`${category.id}: ${error.message}`);
    }
  }
  if (byId.size === 0 && errors.length) throw new Error(errors.join('; '));
  return { items: [...byId.values()], warnings: errors };
}

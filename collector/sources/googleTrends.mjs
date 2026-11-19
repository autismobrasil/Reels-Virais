import { getBlocks, getText } from '../lib/xml.mjs';
import { hashId, parseTraffic, toIso } from '../lib/util.mjs';

export const TRENDS_URL = 'https://trends.google.com/trending/rss?geo=BR';

export function parseGoogleTrends(xml) {
  return getBlocks(xml, 'item')
    .map((item) => {
      const title = getText(item, 'title');
      const traffic = getText(item, 'ht:approx_traffic');
      const news = getBlocks(item, 'ht:news_item')
        .map((n) => ({
          title: getText(n, 'ht:news_item_title'),
          url: getText(n, 'ht:news_item_url'),
          source: getText(n, 'ht:news_item_source'),
        }))
        .filter((n) => n.title && n.url);
      return {
        id: `t:${hashId(title.toLowerCase())}`,
        type: 'trend',
        title,
        url: `https://www.google.com/search?q=${encodeURIComponent(title)}`,
        traffic,
        trafficNum: parseTraffic(traffic),
        image: getText(item, 'ht:picture') || null,
        publishedAt: toIso(getText(item, 'pubDate')),
        news,
      };
    })
    .filter((item) => item.title);
}

export async function fetchGoogleTrends({ fetchText }) {
  const xml = await fetchText(TRENDS_URL);
  return { items: parseGoogleTrends(xml), warnings: [] };
}

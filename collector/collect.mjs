// Coletor do Reels Virais: busca notícias, assuntos em alta e vídeos virais
// e grava tudo em public/data/feed.json, que o app web lê.
//
// Uso: npm run collect
// Variáveis: YOUTUBE_API_KEY (opcional), OUT_DIR (padrão: public/data)

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyModeration, loadBlocklist } from './lib/moderation.mjs';
import { NEWS_CATEGORIES, fetchGoogleNews } from './sources/googleNews.mjs';
import { fetchGoogleTrends } from './sources/googleTrends.mjs';
import { VIDEO_CATEGORIES, fetchYouTubeTrending } from './sources/youtube.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const outDir = process.env.OUT_DIR ?? join(here, '..', 'public', 'data');
const apiKey = process.env.YOUTUBE_API_KEY?.trim();
const MAX_NEWS = 300;

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'reels-virais-collector/0.1', 'accept-language': 'pt-BR,pt;q=0.9' },
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.text();
}

async function runSource(name, fn) {
  try {
    const { items, warnings } = await fn();
    for (const w of warnings) console.warn(`  [${name}] aviso: ${w}`);
    console.log(`  [${name}] ${items.length} itens`);
    return { status: { name, ok: true, count: items.length }, items };
  } catch (error) {
    console.error(`  [${name}] falhou: ${error.message}`);
    return { status: { name, ok: false, count: 0, error: error.message }, items: [] };
  }
}

async function main() {
  const now = new Date();
  const blocklist = await loadBlocklist(join(here, 'blocklist.json'));
  console.log('Coletando…');

  const tasks = [
    runSource('google-trends', () => fetchGoogleTrends({ fetchText })),
    runSource('google-news', () => fetchGoogleNews({ fetchText })),
  ];
  if (apiKey) {
    tasks.push(runSource('youtube', () => fetchYouTubeTrending({ fetchText, apiKey, now })));
  } else {
    console.warn('  [youtube] ignorado: defina YOUTUBE_API_KEY para coletar vídeos');
  }
  const results = await Promise.all(tasks);
  const all = applyModeration(results.flatMap((r) => r.items), blocklist);

  const byDate = (a, b) => (b.publishedAt ?? '').localeCompare(a.publishedAt ?? '');
  const feed = {
    generatedAt: now.toISOString(),
    sources: results.map((r) => r.status),
    categories: {
      news: NEWS_CATEGORIES.map(({ id, label }) => ({ id, label })),
      videos: VIDEO_CATEGORIES.map(({ id, label }) => ({ id, label })),
    },
    trends: all.filter((i) => i.type === 'trend').sort((a, b) => b.trafficNum - a.trafficNum),
    videos: all.filter((i) => i.type === 'video').sort((a, b) => b.score - a.score),
    news: all.filter((i) => i.type === 'news').sort(byDate).slice(0, MAX_NEWS),
  };

  const total = feed.trends.length + feed.videos.length + feed.news.length;
  if (total === 0) {
    console.error('Nenhum item coletado; feed não foi gravado.');
    process.exit(1);
  }

  await mkdir(outDir, { recursive: true });
  const outFile = join(outDir, 'feed.json');
  await writeFile(outFile, JSON.stringify(feed));
  console.log(
    `Feed gravado em ${outFile}: ${feed.trends.length} assuntos, ${feed.videos.length} vídeos, ${feed.news.length} notícias.`,
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

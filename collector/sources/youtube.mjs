import { viralScore } from '../lib/util.mjs';

const API = 'https://www.googleapis.com/youtube/v3/videos';

// IDs de categoria do YouTube. "chart=mostPopular" custa só 1 unidade de cota por chamada.
export const VIDEO_CATEGORIES = [
  { id: 'todos', label: 'Todos', ytId: null },
  { id: 'musica', label: 'Música', ytId: '10' },
  { id: 'games', label: 'Games', ytId: '20' },
  { id: 'esportes', label: 'Esportes', ytId: '17' },
  { id: 'entretenimento', label: 'Entretenimento', ytId: '24' },
  { id: 'humor', label: 'Humor', ytId: '23' },
  { id: 'noticias', label: 'Notícias', ytId: '25' },
];

export function trendingUrl(apiKey, ytCategoryId, regionCode = 'BR') {
  const params = new URLSearchParams({
    part: 'snippet,statistics',
    chart: 'mostPopular',
    regionCode,
    hl: 'pt-BR',
    maxResults: '50',
    key: apiKey,
  });
  if (ytCategoryId) params.set('videoCategoryId', ytCategoryId);
  return `${API}?${params}`;
}

export function parseYouTubeVideos(json, categoryId, now = new Date()) {
  return (json.items ?? []).map((video) => {
    const { snippet = {}, statistics = {} } = video;
    const thumbs = snippet.thumbnails ?? {};
    const item = {
      id: `yt:${video.id}`,
      type: 'video',
      videoId: video.id,
      title: snippet.title ?? '',
      url: `https://www.youtube.com/watch?v=${video.id}`,
      channel: snippet.channelTitle ?? '',
      channelId: snippet.channelId ?? '',
      publishedAt: snippet.publishedAt ?? null,
      thumbnail: (thumbs.high ?? thumbs.medium ?? thumbs.default ?? {}).url ?? null,
      views: Number(statistics.viewCount ?? 0),
      likes: Number(statistics.likeCount ?? 0),
      comments: Number(statistics.commentCount ?? 0),
      categories: [categoryId],
    };
    item.score = viralScore(item, now);
    return item;
  });
}

export async function fetchYouTubeTrending({ fetchText, apiKey, now = new Date() }) {
  const byId = new Map();
  const warnings = [];
  for (const category of VIDEO_CATEGORIES) {
    try {
      const json = JSON.parse(await fetchText(trendingUrl(apiKey, category.ytId)));
      for (const item of parseYouTubeVideos(json, category.id, now)) {
        const existing = byId.get(item.id);
        if (existing) existing.categories.push(category.id);
        else byId.set(item.id, item);
      }
    } catch (error) {
      // Algumas categorias não têm ranking em certas regiões; seguimos com as outras.
      warnings.push(`${category.id}: ${error.message.replace(apiKey, '***')}`);
    }
  }
  if (byId.size === 0 && warnings.length) throw new Error(warnings.join('; '));
  return { items: [...byId.values()], warnings };
}

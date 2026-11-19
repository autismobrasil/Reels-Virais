import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeEntities, getAttr, getBlocks, getText } from '../collector/lib/xml.mjs';
import { parseTraffic, viralScore } from '../collector/lib/util.mjs';
import { isBlocked } from '../collector/lib/moderation.mjs';
import { fetchGoogleNews, parseGoogleNews } from '../collector/sources/googleNews.mjs';
import { parseGoogleTrends } from '../collector/sources/googleTrends.mjs';
import { parseYouTubeVideos } from '../collector/sources/youtube.mjs';

const NEWS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"><channel><title>Principais notícias</title>
<item>
  <title>Chuva forte atinge São Paulo &amp; região - G1</title>
  <link>https://news.google.com/rss/articles/abc?oc=5</link>
  <pubDate>Wed, 18 Nov 2026 12:00:00 GMT</pubDate>
  <description>&lt;a href="x"&gt;ignorado&lt;/a&gt;</description>
  <source url="https://g1.globo.com">G1</source>
</item>
<item>
  <title><![CDATA[Seleção convoca novos jogadores - Folha]]></title>
  <link>https://news.google.com/rss/articles/def</link>
  <pubDate>Wed, 18 Nov 2026 13:30:00 GMT</pubDate>
  <source url="https://www.folha.uol.com.br">Folha</source>
</item>
</channel></rss>`;

const TRENDS_XML = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:ht="https://trends.google.com/trending/rss" version="2.0"><channel>
<item>
  <title>final da copa</title>
  <ht:approx_traffic>200 mil+</ht:approx_traffic>
  <pubDate>Wed, 18 Nov 2026 10:00:00 -0800</pubDate>
  <ht:picture>https://example.com/img.jpg</ht:picture>
  <ht:news_item>
    <ht:news_item_title>Quem joga a final</ht:news_item_title>
    <ht:news_item_url>https://example.com/final</ht:news_item_url>
    <ht:news_item_source>ge</ht:news_item_source>
  </ht:news_item>
  <ht:news_item>
    <ht:news_item_title>Horário do jogo</ht:news_item_title>
    <ht:news_item_url>https://example.com/horario</ht:news_item_url>
    <ht:news_item_source>UOL</ht:news_item_source>
  </ht:news_item>
</item>
<item><title>show surpresa</title><ht:approx_traffic>2000+</ht:approx_traffic></item>
</channel></rss>`;

test('xml: decodifica entidades, CDATA e atributos', () => {
  assert.equal(decodeEntities('a &amp; b &#233; &#xE7; &quot;x&quot;'), 'a & b é ç "x"');
  assert.equal(getText('<t><![CDATA[<b>oi</b>]]></t>', 't'), '<b>oi</b>');
  assert.equal(getAttr('<source url="https://a.com?x=1&amp;y=2">A</source>', 'source', 'url'), 'https://a.com?x=1&y=2');
  assert.equal(getBlocks('<items><item>1</item><item>2</item></items>', 'item').length, 2);
});

test('google news: limpa o título e extrai fonte e data', () => {
  const items = parseGoogleNews(NEWS_XML, 'destaques');
  assert.equal(items.length, 2);
  assert.equal(items[0].title, 'Chuva forte atinge São Paulo & região');
  assert.equal(items[0].source, 'G1');
  assert.equal(items[0].sourceUrl, 'https://g1.globo.com');
  assert.equal(items[0].publishedAt, '2026-11-18T12:00:00.000Z');
  assert.equal(items[1].title, 'Seleção convoca novos jogadores');
  assert.deepEqual(items[1].categories, ['destaques']);
});

test('google news: junta categorias de notícias repetidas e tolera falhas', async () => {
  let calls = 0;
  const fetchText = async () => {
    calls += 1;
    if (calls === 3) throw new Error('HTTP 500');
    return NEWS_XML;
  };
  const { items, warnings } = await fetchGoogleNews({ fetchText });
  assert.equal(items.length, 2);
  assert.ok(items[0].categories.includes('destaques'));
  assert.ok(items[0].categories.includes('brasil'));
  assert.equal(warnings.length, 1);
});

test('google trends: tráfego e notícias relacionadas', () => {
  const [first, second] = parseGoogleTrends(TRENDS_XML);
  assert.equal(first.title, 'final da copa');
  assert.equal(first.trafficNum, 200_000);
  assert.equal(first.news.length, 2);
  assert.equal(first.news[1].source, 'UOL');
  assert.equal(first.image, 'https://example.com/img.jpg');
  assert.equal(second.trafficNum, 2000);
  assert.equal(second.news.length, 0);
});

test('parseTraffic entende formatos comuns', () => {
  assert.equal(parseTraffic('2000+'), 2000);
  assert.equal(parseTraffic('20 mil+'), 20_000);
  assert.equal(parseTraffic('1,5 mi+'), 1_500_000);
  assert.equal(parseTraffic('50K+'), 50_000);
  assert.equal(parseTraffic('1.500+'), 1500);
  assert.equal(parseTraffic(''), 0);
});

test('youtube: converte resposta da API e calcula pontuação', () => {
  const now = new Date('2026-11-18T12:00:00Z');
  const json = {
    items: [
      {
        id: 'abc123',
        snippet: {
          title: 'Vídeo novo',
          channelTitle: 'Canal',
          channelId: 'UC1',
          publishedAt: '2026-11-18T10:00:00Z',
          thumbnails: { high: { url: 'https://i.ytimg.com/vi/abc123/hq.jpg' } },
        },
        statistics: { viewCount: '100000', likeCount: '5000', commentCount: '300' },
      },
    ],
  };
  const [video] = parseYouTubeVideos(json, 'todos', now);
  assert.equal(video.url, 'https://www.youtube.com/watch?v=abc123');
  assert.equal(video.views, 100_000);
  assert.equal(video.thumbnail, 'https://i.ytimg.com/vi/abc123/hq.jpg');
  assert.ok(video.score > 0);
});

test('viralScore favorece vídeos recentes com o mesmo número de views', () => {
  const now = new Date('2026-11-18T12:00:00Z');
  const recent = viralScore({ views: 100_000, publishedAt: '2026-11-18T10:00:00Z' }, now);
  const old = viralScore({ views: 100_000, publishedAt: '2026-11-10T10:00:00Z' }, now);
  assert.ok(recent > old * 10);
});

test('moderação bloqueia termos (sem acento), domínios e canais', () => {
  const blocklist = { terms: ['dioxido de cloro'], domains: ['golpe.com'], youtubeChannels: ['UCbad'] };
  assert.ok(isBlocked({ title: 'Dióxido de Cloro cura tudo' }, blocklist));
  assert.ok(isBlocked({ title: 'ok', url: 'https://www.golpe.com/x' }, blocklist));
  assert.ok(isBlocked({ title: 'ok', channelId: 'UCbad' }, blocklist));
  assert.ok(!isBlocked({ title: 'Notícia normal', url: 'https://g1.globo.com' }, blocklist));
  assert.ok(!isBlocked({ title: 'ok', url: 'https://naogolpe.com' }, blocklist));
});

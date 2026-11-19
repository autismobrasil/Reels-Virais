// Reels Virais: app web que lê data/feed.json (gerado pelo coletor) e mostra
// assuntos em alta, vídeos virais e notícias, com busca e filtros.

const REPO_URL = 'https://github.com/autismobrasil/Reels-Virais';
const TABS = ['alta', 'videos', 'noticias'];

const state = { feed: null, tab: 'alta', category: '', query: '' };
const $ = (sel) => document.querySelector(sel);

// ---------- utilidades ----------

function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value == null || value === false) continue;
    if (key === 'class') el.className = value;
    else if (key.startsWith('on')) el.addEventListener(key.slice(2), value);
    else el.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    el.append(child instanceof Node ? child : document.createTextNode(String(child)));
  }
  return el;
}

/** Só aceita links http(s) vindos do feed. */
function safeUrl(url) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : null;
  } catch {
    return null;
  }
}

const normalize = (s) =>
  String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

const compact = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });
const relative = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' });

function timeAgo(iso) {
  if (!iso) return '';
  const seconds = (new Date(iso).getTime() - Date.now()) / 1000;
  if (!Number.isFinite(seconds)) return '';
  const units = [
    ['year', 31_536_000], ['month', 2_592_000], ['week', 604_800],
    ['day', 86_400], ['hour', 3_600], ['minute', 60],
  ];
  for (const [unit, size] of units) {
    if (Math.abs(seconds) >= size) return relative.format(Math.round(seconds / size), unit);
  }
  return 'agora';
}

function matches(item, terms) {
  if (!terms.length) return true;
  const text = normalize(
    [item.title, item.source, item.channel, ...(item.news ?? []).map((n) => n.title)].join(' '),
  );
  return terms.every((t) => text.includes(t));
}

function reportLink(item) {
  const params = new URLSearchParams({
    template: 'denunciar-conteudo.yml',
    title: `[Denúncia] ${item.title}`.slice(0, 200),
    link: item.url,
  });
  return h('a', { class: 'report', href: `${REPO_URL}/issues/new?${params}`, target: '_blank', rel: 'noopener' }, 'Denunciar');
}

// ---------- cartões ----------

function videoCard(video, rank) {
  const thumb = safeUrl(video.thumbnail);
  return h('article', { class: 'card' },
    h('button', { class: 'thumb', type: 'button', 'aria-label': `Assistir: ${video.title}`, onclick: () => openPlayer(video) },
      thumb ? h('img', { src: thumb, alt: '', loading: 'lazy', width: 480, height: 270 }) : null,
      rank ? h('span', { class: 'rank' }, `#${rank}`) : null,
      h('span', { class: 'play', 'aria-hidden': 'true' }, '▶'),
    ),
    h('div', { class: 'card-body' },
      h('h3', {}, h('a', { href: safeUrl(video.url), target: '_blank', rel: 'noopener' }, video.title)),
      h('p', { class: 'meta' },
        h('span', {}, video.channel),
        video.views ? h('span', {}, `${compact.format(video.views)} visualizações`) : null,
        h('span', {}, timeAgo(video.publishedAt)),
      ),
      h('div', { class: 'card-actions' }, reportLink(video)),
    ),
  );
}

function trendCard(trend, rank) {
  return h('article', { class: 'card trend' },
    h('div', { class: 'trend-rank', 'aria-label': `Posição ${rank}` }, rank),
    h('div', { class: 'card-body' },
      h('h3', {}, h('a', { href: safeUrl(trend.url), target: '_blank', rel: 'noopener' }, trend.title)),
      h('p', { class: 'meta' },
        trend.traffic ? h('span', { class: 'badge' }, `${trend.traffic} buscas`) : null,
        h('span', {}, timeAgo(trend.publishedAt)),
      ),
      trend.news?.length
        ? h('ul', {}, trend.news.slice(0, 3).map((n) =>
            h('li', {}, h('a', { href: safeUrl(n.url), target: '_blank', rel: 'noopener' }, n.title),
              n.source ? h('span', { class: 'src' }, ` · ${n.source}`) : null)))
        : null,
    ),
  );
}

function newsCard(item) {
  return h('article', { class: 'card news-item' },
    h('h3', {}, h('a', { href: safeUrl(item.url), target: '_blank', rel: 'noopener' }, item.title)),
    h('p', { class: 'meta' },
      item.source ? h('strong', {}, item.source) : null,
      h('span', {}, timeAgo(item.publishedAt)),
      h('span', { style: 'margin-left:auto' }, reportLink(item)),
    ),
  );
}

const empty = (text) => h('p', { class: 'empty' }, text);

// ---------- telas ----------

function renderAlta(terms) {
  const { trends, videos, news } = state.feed;
  const t = trends.filter((i) => matches(i, terms)).slice(0, terms.length ? 50 : 10);
  const v = videos.filter((i) => matches(i, terms)).slice(0, terms.length ? 50 : 8);
  const n = news.filter((i) => matches(i, terms)).slice(0, terms.length ? 50 : 8);
  if (!t.length && !v.length && !n.length) {
    return [empty(terms.length ? 'Nada encontrado para essa busca.' : 'Ainda não há conteúdo coletado.')];
  }
  return [
    t.length ? [h('h2', { class: 'section-title' }, 'Assuntos em alta no Brasil'), h('div', { class: 'list trends' }, t.map((x, i) => trendCard(x, i + 1)))] : null,
    v.length ? [h('h2', { class: 'section-title' }, 'Vídeos virais'), h('div', { class: 'grid' }, v.map((x, i) => videoCard(x, terms.length ? null : i + 1)))] : null,
    n.length ? [h('h2', { class: 'section-title' }, 'Últimas notícias'), h('div', { class: 'list' }, n.map(newsCard))] : null,
  ];
}

function renderList(kind, terms) {
  const items = state.feed[kind].filter(
    (i) => (!state.category || i.categories?.includes(state.category)) && matches(i, terms),
  );
  if (!items.length) {
    if (kind === 'videos' && !state.feed.videos.length) {
      return [empty('Nenhum vídeo coletado ainda. Configure a chave da API do YouTube (veja o README).')];
    }
    return [empty('Nada encontrado aqui.')];
  }
  return kind === 'videos'
    ? [h('div', { class: 'grid' }, items.slice(0, 60).map((x, i) => videoCard(x, terms.length ? null : i + 1)))]
    : [h('div', { class: 'list' }, items.slice(0, 120).map(newsCard))];
}

function renderChips() {
  const chips = $('#chips');
  const list = state.tab === 'videos' ? state.feed.categories.videos
    : state.tab === 'noticias' ? state.feed.categories.news : null;
  chips.hidden = !list;
  if (!list) return;
  if (!list.some((c) => c.id === state.category)) state.category = list[0].id;
  chips.replaceChildren(...list.map((c) =>
    h('button', {
      class: 'chip', type: 'button', 'aria-pressed': String(c.id === state.category),
      onclick: () => { state.category = c.id; render(); },
    }, c.label)));
}

function render() {
  if (!state.feed) return;
  for (const tab of document.querySelectorAll('.tab')) {
    tab.toggleAttribute('aria-current', false);
    if (tab.dataset.tab === state.tab) tab.setAttribute('aria-current', 'page');
  }
  renderChips();
  const terms = normalize(state.query).split(/\s+/).filter(Boolean);
  const content = state.tab === 'alta' ? renderAlta(terms)
    : renderList(state.tab === 'videos' ? 'videos' : 'news', terms);
  $('#view').replaceChildren(...content.flat(2).filter(Boolean));
  syncUrl();
}

// ---------- URL (para compartilhar a busca) ----------

function readUrl() {
  const params = new URLSearchParams(location.search);
  const tab = params.get('aba');
  if (TABS.includes(tab)) state.tab = tab;
  state.category = params.get('cat') ?? '';
  state.query = params.get('q') ?? '';
  $('#q').value = state.query;
}

function syncUrl() {
  const params = new URLSearchParams();
  if (state.tab !== 'alta') params.set('aba', state.tab);
  if (state.tab !== 'alta' && state.category) params.set('cat', state.category);
  if (state.query) params.set('q', state.query);
  const qs = params.toString();
  history.replaceState(null, '', qs ? `?${qs}` : location.pathname);
}

// ---------- player ----------

function openPlayer(video) {
  const dialog = $('#player');
  $('#player-title').textContent = video.title;
  $('#player-yt').href = safeUrl(video.url) ?? '#';
  const id = encodeURIComponent(video.videoId);
  // youtube-nocookie e sem autoplay: o vídeo só toca quando a pessoa aperta play.
  $('#player-frame').replaceChildren(h('iframe', {
    src: `https://www.youtube-nocookie.com/embed/${id}?rel=0`,
    title: video.title,
    allow: 'encrypted-media; picture-in-picture; fullscreen',
    allowfullscreen: true,
    loading: 'lazy',
  }));
  dialog.showModal();
}

function closePlayer() {
  $('#player-frame').replaceChildren();
  $('#player').close();
}

// ---------- inicialização ----------

async function loadFeed() {
  for (const [file, sample] of [['data/feed.json', false], ['data/feed.sample.json', true]]) {
    try {
      const res = await fetch(file, { cache: 'no-cache' });
      if (!res.ok) continue;
      const feed = await res.json();
      return { feed, sample };
    } catch {
      // tenta o próximo
    }
  }
  return null;
}

function showUpdated(feed, sample) {
  const notice = $('#notice');
  if (sample) {
    notice.hidden = false;
    notice.textContent = 'Você está vendo dados de exemplo. Rode "npm run collect" para buscar conteúdo real.';
  }
  const failed = feed.sources?.filter((s) => !s.ok).map((s) => s.name) ?? [];
  const when = new Date(feed.generatedAt);
  $('#updated').textContent =
    `Atualizado ${timeAgo(feed.generatedAt)} (${when.toLocaleString('pt-BR')}).` +
    (failed.length ? ` Fontes indisponíveis nesta coleta: ${failed.join(', ')}.` : '');
}

function setupContrast() {
  const button = $('#contrast-toggle');
  const sync = () => button.setAttribute('aria-pressed', String(document.documentElement.dataset.contrast === 'high'));
  button.addEventListener('click', () => {
    const high = document.documentElement.dataset.contrast !== 'high';
    if (high) document.documentElement.dataset.contrast = 'high';
    else delete document.documentElement.dataset.contrast;
    try { localStorage.setItem('reels-virais:contrast', high ? 'high' : 'normal'); } catch {}
    sync();
  });
  sync();
}

async function init() {
  readUrl();
  setupContrast();

  for (const tab of document.querySelectorAll('.tab')) {
    tab.addEventListener('click', () => { state.tab = tab.dataset.tab; state.category = ''; render(); });
  }
  let debounce;
  $('#q').addEventListener('input', (e) => {
    clearTimeout(debounce);
    debounce = setTimeout(() => { state.query = e.target.value; render(); }, 150);
  });
  $('#search-form').addEventListener('submit', (e) => {
    e.preventDefault();
    state.query = $('#q').value;
    render();
  });
  $('#player-close').addEventListener('click', closePlayer);
  $('#player').addEventListener('cancel', (e) => { e.preventDefault(); closePlayer(); });
  $('#player').addEventListener('click', (e) => { if (e.target.id === 'player') closePlayer(); });

  const loaded = await loadFeed();
  if (!loaded) {
    $('#view').replaceChildren(empty('Não foi possível carregar o conteúdo. Tente novamente mais tarde.'));
    return;
  }
  state.feed = loaded.feed;
  showUpdated(loaded.feed, loaded.sample);
  render();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
}

init();

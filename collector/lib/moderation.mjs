import { readFile } from 'node:fs/promises';

const normalize = (s) =>
  String(s ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

export async function loadBlocklist(path) {
  const data = JSON.parse(await readFile(path, 'utf8'));
  return {
    terms: (data.terms ?? []).map(normalize).filter(Boolean),
    domains: (data.domains ?? []).map((d) => d.toLowerCase()),
    youtubeChannels: data.youtubeChannels ?? [],
  };
}

function hostOf(url) {
  try {
    return new URL(url).hostname.toLowerCase();
  } catch {
    return '';
  }
}

/** Retorna true se o item deve ser removido do feed. */
export function isBlocked(item, blocklist) {
  const text = normalize(`${item.title} ${item.source ?? ''} ${item.channel ?? ''}`);
  if (blocklist.terms.some((term) => text.includes(term))) return true;
  if (item.channelId && blocklist.youtubeChannels.includes(item.channelId)) return true;
  const hosts = [item.url, item.sourceUrl].filter(Boolean).map(hostOf);
  return hosts.some((host) =>
    blocklist.domains.some((d) => host === d || host.endsWith(`.${d}`)),
  );
}

export function applyModeration(items, blocklist) {
  return items.filter((item) => !isBlocked(item, blocklist));
}

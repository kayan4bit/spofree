/**
 * Podcast service — scrapes iTunes Search API for podcast discovery
 * and fetches RSS feeds via public CORS proxies for episodes.
 *
 * No API key required. Entirely client-side.
 */

export interface Podcast {
  id: number;                 // iTunes collectionId
  title: string;              // Show title
  author: string;             // Publisher / artist
  artwork: string;            // 600px artwork URL
  feedUrl: string;            // RSS feed URL
  genre?: string;
  trackCount?: number;
  country?: string;
}

export interface Episode {
  id: string;                 // guid or enclosure URL
  title: string;
  description: string;
  pubDate: string;            // raw string
  duration: number;           // seconds (0 if unknown)
  audioUrl: string;           // enclosure URL
  artwork?: string;
  podcastTitle: string;
  podcastAuthor: string;
  podcastArtwork: string;
}

/** Fallback list of public CORS proxies. We try them in order. */
const CORS_PROXIES: string[] = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
  'https://cors.sh/?',
];

const ITUNES_SEARCH = 'https://itunes.apple.com/search';
const ITUNES_LOOKUP = 'https://itunes.apple.com/lookup';

const SUBS_KEY = 'atomic_podcast_subs_v1';
const RECENTS_KEY = 'atomic_podcast_recent_v1';

/** In-memory caches */
const feedCache = new Map<string, { episodes: Episode[]; expiresAt: number }>();
const searchCache = new Map<string, { results: Podcast[]; expiresAt: number }>();
const FEED_TTL = 15 * 60 * 1000;
const SEARCH_TTL = 10 * 60 * 1000;

const parsePodcast = (item: any): Podcast | null => {
  if (!item?.collectionId || !item?.feedUrl) return null;
  return {
    id: item.collectionId,
    title: item.collectionName || item.trackName || 'Untitled',
    author: item.artistName || 'Unknown',
    artwork: (item.artworkUrl600 || item.artworkUrl100 || '').replace(/^http:/, 'https:'),
    feedUrl: item.feedUrl.replace(/^http:/, 'https:'),
    genre: item.primaryGenreName,
    trackCount: item.trackCount,
    country: item.country,
  };
};

export const searchPodcasts = async (query: string, limit: number = 30): Promise<Podcast[]> => {
  const q = query.trim();
  if (!q) return [];
  const key = `${q.toLowerCase()}|${limit}`;
  const cached = searchCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const url = `${ITUNES_SEARCH}?media=podcast&term=${encodeURIComponent(q)}&limit=${limit}`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const json = await r.json();
    const podcasts = (json.results || []).map(parsePodcast).filter(Boolean) as Podcast[];
    searchCache.set(key, { results: podcasts, expiresAt: Date.now() + SEARCH_TTL });
    return podcasts;
  } catch {
    return [];
  }
};

export const lookupPodcast = async (collectionId: number | string): Promise<Podcast | null> => {
  try {
    const r = await fetch(`${ITUNES_LOOKUP}?id=${collectionId}`);
    if (!r.ok) return null;
    const json = await r.json();
    const first = (json.results || [])[0];
    return first ? parsePodcast(first) : null;
  } catch {
    return null;
  }
};

export const topPodcasts = async (genre?: string, limit: number = 50): Promise<Podcast[]> => {
  // iTunes RSS "top podcasts" feed. Falls back to a generic search if genre omitted.
  const genrePath = genre ? `/genre=${genre}` : '';
  const url = `https://itunes.apple.com/us/rss/toppodcasts/limit=${limit}${genrePath}/json`;
  try {
    const r = await fetch(url);
    if (!r.ok) return [];
    const json = await r.json();
    const entries = json?.feed?.entry || [];
    // Top-charts feed doesn't include feedUrl — we need a second lookup call.
    const ids = entries
      .map((e: any) => e?.id?.attributes?.['im:id'])
      .filter(Boolean)
      .slice(0, Math.min(limit, 50))
      .join(',');
    if (!ids) return [];
    const lookup = await fetch(`${ITUNES_LOOKUP}?id=${ids}&entity=podcast`);
    if (!lookup.ok) return [];
    const lj = await lookup.json();
    return (lj.results || []).map(parsePodcast).filter(Boolean) as Podcast[];
  } catch {
    return [];
  }
};

/** Fetch raw feed XML with a CORS-proxy cascade. */
async function fetchFeedXml(feedUrl: string): Promise<string | null> {
  // Try direct first (some feeds allow CORS).
  try {
    const r = await fetch(feedUrl, { mode: 'cors' });
    if (r.ok) {
      const t = await r.text();
      if (t && t.length > 200) return t;
    }
  } catch { /* fall through */ }

  for (const proxy of CORS_PROXIES) {
    try {
      const r = await fetch(`${proxy}${encodeURIComponent(feedUrl)}`);
      if (r.ok) {
        const t = await r.text();
        if (t && t.length > 200) return t;
      }
    } catch { /* next proxy */ }
  }
  return null;
}

const parseDuration = (raw: string | undefined): number => {
  if (!raw) return 0;
  const s = raw.trim();
  if (/^\d+$/.test(s)) return parseInt(s, 10);
  const parts = s.split(':').map(n => parseInt(n, 10));
  if (parts.some(isNaN)) return 0;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  if (parts.length === 1) return parts[0];
  return 0;
};

const decodeHtml = (html: string): string => {
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
};

const stripTags = (html: string): string => decodeHtml(html).replace(/<[^>]+>/g, '').trim();

/**
 * Minimal RSS / Atom parser. Pulls channel metadata and <item> / <entry>
 * elements with enclosure URLs. Regex-based — we avoid DOMParser because it
 * chokes on some podcast feeds' namespaces.
 */
function parseFeed(xml: string, podcast: { title: string; author: string; artwork: string }): Episode[] {
  const episodes: Episode[] = [];
  const itemRe = /<item[\s>][\s\S]*?<\/item>/gi;
  const entryRe = /<entry[\s>][\s\S]*?<\/entry>/gi;

  const chunks = xml.match(itemRe) || xml.match(entryRe) || [];

  for (const chunk of chunks) {
    const titleMatch = chunk.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = chunk.match(/<(?:itunes:summary|description|content:encoded|summary)[^>]*>([\s\S]*?)<\/(?:itunes:summary|description|content:encoded|summary)>/i);
    const pubMatch = chunk.match(/<(?:pubDate|published|updated)[^>]*>([\s\S]*?)<\/(?:pubDate|published|updated)>/i);
    const durMatch = chunk.match(/<itunes:duration[^>]*>([\s\S]*?)<\/itunes:duration>/i);
    const enclosureMatch = chunk.match(/<enclosure[^>]*url="([^"]+)"[^>]*\/?>/i);
    const linkMatch = chunk.match(/<link[^>]*href="([^"]+)"[^>]*type="audio[^"]*"/i);
    const guidMatch = chunk.match(/<(?:guid|id)[^>]*>([\s\S]*?)<\/(?:guid|id)>/i);
    const imgMatch = chunk.match(/<itunes:image[^>]*href="([^"]+)"/i);

    const audioUrl = enclosureMatch?.[1] || linkMatch?.[1];
    if (!audioUrl) continue;

    episodes.push({
      id: (guidMatch?.[1] || audioUrl).trim(),
      title: titleMatch ? stripTags(titleMatch[1]) : 'Untitled Episode',
      description: descMatch ? stripTags(descMatch[1]).slice(0, 2000) : '',
      pubDate: pubMatch ? stripTags(pubMatch[1]) : '',
      duration: durMatch ? parseDuration(stripTags(durMatch[1])) : 0,
      audioUrl: audioUrl.replace(/^http:/, 'https:'),
      artwork: imgMatch ? imgMatch[1].replace(/^http:/, 'https:') : podcast.artwork,
      podcastTitle: podcast.title,
      podcastAuthor: podcast.author,
      podcastArtwork: podcast.artwork,
    });
  }

  return episodes;
}

export const getEpisodes = async (podcast: Podcast, force: boolean = false): Promise<Episode[]> => {
  if (!force) {
    const hit = feedCache.get(podcast.feedUrl);
    if (hit && hit.expiresAt > Date.now()) return hit.episodes;
  }
  const xml = await fetchFeedXml(podcast.feedUrl);
  if (!xml) return [];
  const episodes = parseFeed(xml, podcast);
  feedCache.set(podcast.feedUrl, { episodes, expiresAt: Date.now() + FEED_TTL });
  return episodes;
};

// --- Subscriptions (persisted to localStorage) ---

const readSubs = (): Podcast[] => {
  try { return JSON.parse(localStorage.getItem(SUBS_KEY) || '[]'); } catch { return []; }
};
const writeSubs = (v: Podcast[]) => {
  try { localStorage.setItem(SUBS_KEY, JSON.stringify(v)); } catch {}
};

export const podcastLibrary = {
  list(): Podcast[] { return readSubs(); },
  isSubscribed(id: number): boolean { return readSubs().some(p => p.id === id); },
  subscribe(p: Podcast) {
    const subs = readSubs();
    if (subs.some(s => s.id === p.id)) return;
    subs.unshift(p);
    writeSubs(subs);
  },
  unsubscribe(id: number) {
    writeSubs(readSubs().filter(p => p.id !== id));
  },
  clear() { writeSubs([]); },
};

// --- Recently played episodes ---

export const recentEpisodes = {
  list(limit: number = 20): Episode[] {
    try { return (JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]') as Episode[]).slice(0, limit); }
    catch { return []; }
  },
  add(ep: Episode) {
    try {
      const cur = (JSON.parse(localStorage.getItem(RECENTS_KEY) || '[]') as Episode[]).filter(e => e.id !== ep.id);
      cur.unshift(ep);
      localStorage.setItem(RECENTS_KEY, JSON.stringify(cur.slice(0, 40)));
    } catch {}
  },
  clear() { try { localStorage.removeItem(RECENTS_KEY); } catch {} },
};

/**
 * Convert an Episode into a Track-shaped object so it can flow through the
 * existing player pipeline. ID is prefixed with "pod:" so we can detect
 * podcast tracks and bypass the TIDAL stream resolver.
 */
export const episodeToTrack = (ep: Episode) => ({
  id: `pod:${ep.id}` as any,
  title: ep.title,
  artist: { id: 0 as any, name: ep.podcastAuthor, picture: ep.podcastArtwork },
  album: { id: 0 as any, title: ep.podcastTitle, cover: ep.podcastArtwork },
  duration: ep.duration,
  quality: 'LOSSLESS' as any,
  // Private fields carried through for the player to use.
  __podcastUrl: ep.audioUrl,
  __isPodcast: true,
});

export const isPodcastTrack = (t: any): boolean => {
  if (!t) return false;
  return t.__isPodcast === true || (typeof t.id === 'string' && t.id.startsWith('pod:'));
};

export const getPodcastStreamUrl = (t: any): string | null => t?.__podcastUrl || null;

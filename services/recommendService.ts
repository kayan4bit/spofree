import { Track, Album, Artist, RecentlyPlayedItem } from '../types';
import { searchAll, getArtistAlbums, getArtistTopTracks } from './hifiService';

export interface RecommendationSection {
  id: string;
  title: string;
  subtitle?: string;
  items: any[];
  type: 'ALBUM' | 'PLAYLIST' | 'ARTIST' | 'TRACK';
  accent?: 'cyan' | 'violet' | 'pink' | 'amber';
}

// Weighted seeding: recent > liked > saved
interface ScoredArtist { name: string; id?: string | number; score: number; }
interface ScoredAlbum { title: string; artistName?: string; id?: string | number; score: number; }

const normalize = (s: string) => (s || '').trim().toLowerCase();

const scoreArtists = (
  likedSongs: Track[],
  recentlyPlayed: RecentlyPlayedItem[],
  followedArtists: Artist[],
): ScoredArtist[] => {
  const bucket = new Map<string, ScoredArtist>();
  const bump = (name: string | undefined, id: string | number | undefined, weight: number) => {
    if (!name) return;
    const key = normalize(name);
    const existing = bucket.get(key);
    if (existing) {
      existing.score += weight;
      if (!existing.id && id) existing.id = id;
    } else {
      bucket.set(key, { name, id, score: weight });
    }
  };
  likedSongs.forEach(t => bump(t.artist?.name, t.artist?.id, 3));
  recentlyPlayed.forEach((item, idx) => {
    const recencyWeight = 8 / Math.max(1, idx + 1);
    if (item.type === 'TRACK') {
      const t = item.data as Track;
      bump(t.artist?.name, t.artist?.id, recencyWeight);
    } else if (item.type === 'ALBUM') {
      const a = item.data as Album;
      bump(a.artist?.name, a.artist?.id, recencyWeight * 0.9);
    } else if (item.type === 'ARTIST') {
      const a = item.data as Artist;
      bump(a.name, a.id, recencyWeight * 1.2);
    }
  });
  followedArtists.forEach(a => bump(a.name, a.id, 2));

  return Array.from(bucket.values()).sort((x, y) => y.score - x.score);
};

const scoreAlbums = (
  likedSongs: Track[],
  recentlyPlayed: RecentlyPlayedItem[],
): ScoredAlbum[] => {
  const bucket = new Map<string, ScoredAlbum>();
  const bump = (title: string | undefined, artistName: string | undefined, id: string | number | undefined, weight: number) => {
    if (!title) return;
    const key = normalize(`${title}::${artistName ?? ''}`);
    const existing = bucket.get(key);
    if (existing) {
      existing.score += weight;
      if (!existing.id && id) existing.id = id;
    } else {
      bucket.set(key, { title, artistName, id, score: weight });
    }
  };
  likedSongs.forEach(t => bump(t.album?.title, t.artist?.name, t.album?.id, 2));
  recentlyPlayed.forEach((item, idx) => {
    const recencyWeight = 6 / Math.max(1, idx + 1);
    if (item.type === 'ALBUM') {
      const a = item.data as Album;
      bump(a.title, a.artist?.name, a.id, recencyWeight);
    } else if (item.type === 'TRACK') {
      const t = item.data as Track;
      bump(t.album?.title, t.artist?.name, t.album?.id, recencyWeight * 0.6);
    }
  });
  return Array.from(bucket.values()).sort((x, y) => y.score - x.score);
};

const uniqueById = <T extends { id?: any; uuid?: any }>(items: T[]) => {
  const seen = new Set<string>();
  return items.filter(x => {
    const id = String(x.id ?? x.uuid ?? '');
    if (!id) return true;
    if (seen.has(id)) return false;
    seen.add(id);
    return true;
  });
};

const MOODS = ['chill', 'focus', 'workout', 'late night', 'road trip', 'acoustic', 'jazz', 'lofi hip hop', 'indie', 'electronic'];
const FALLBACK_QUERIES = ['top hits 2024', 'new releases', 'indie pop', 'hip hop classics', 'lo-fi chill'];

// Stable session cache so navigation doesn't re-fetch
const sessionCache = new Map<string, any>();

export async function buildRecommendations(opts: {
  likedSongs: Track[];
  recentlyPlayed: RecentlyPlayedItem[];
  followedArtists: Artist[];
  savedAlbums: Album[];
}): Promise<RecommendationSection[]> {
  const { likedSongs, recentlyPlayed, followedArtists, savedAlbums } = opts;

  const cacheKey = `${likedSongs.length}|${recentlyPlayed.length}|${followedArtists.length}|${savedAlbums.length}|${recentlyPlayed[0]?.timestamp ?? 0}`;
  if (sessionCache.has(cacheKey)) return sessionCache.get(cacheKey);

  const sections: RecommendationSection[] = [];
  const seenAlbumIds = new Set<string>(savedAlbums.map(a => String(a.id)));
  const seenArtistNames = new Set<string>(followedArtists.map(a => normalize(a.name)));

  const topArtists = scoreArtists(likedSongs, recentlyPlayed, followedArtists).slice(0, 3);

  // Because you liked / Because you played sections
  await Promise.all(
    topArtists.map(async (artist, idx) => {
      try {
        const res = await searchAll(artist.name);
        const similar = res.albums
          .filter(a => normalize(a.artist?.name || '') !== normalize(artist.name))
          .filter(a => !seenAlbumIds.has(String(a.id)))
          .slice(0, 6);
        const ownAlbums = res.albums
          .filter(a => normalize(a.artist?.name || '') === normalize(artist.name))
          .filter(a => !seenAlbumIds.has(String(a.id)))
          .slice(0, 6);

        if (ownAlbums.length) {
          ownAlbums.forEach(a => seenAlbumIds.add(String(a.id)));
          sections.push({
            id: `because-${idx}`,
            title: `Because you love ${artist.name}`,
            subtitle: 'More from this artist',
            items: uniqueById(ownAlbums).slice(0, 6),
            type: 'ALBUM',
            accent: (['cyan', 'violet', 'pink', 'amber'] as const)[idx % 4],
          });
        }

        const similarArtists = res.artists
          .filter(a => !seenArtistNames.has(normalize(a.name)))
          .slice(0, 6);
        if (similarArtists.length) {
          similarArtists.forEach(a => seenArtistNames.add(normalize(a.name)));
          sections.push({
            id: `artists-like-${idx}`,
            title: `Artists like ${artist.name}`,
            items: uniqueById(similarArtists).slice(0, 6),
            type: 'ARTIST',
            accent: 'violet',
          });
        }
      } catch (e) {
        console.warn('AI rec (artist) failed', artist.name, e);
      }
    })
  );

  // Picked-for-you tracks from liked artists' top tracks
  try {
    const seedArtists = topArtists.filter(a => a.id).slice(0, 2);
    const trackLists = await Promise.all(
      seedArtists.map(a => getArtistTopTracks(a.id!).then(ts => ts.slice(0, 6)).catch(() => []))
    );
    const likedIds = new Set(likedSongs.map(t => String(t.id)));
    const flat = uniqueById(
      trackLists.flat().filter(t => !likedIds.has(String(t.id)))
    ).slice(0, 10);
    if (flat.length) {
      sections.push({
        id: 'picked-for-you',
        title: 'Picked for you',
        subtitle: 'Tracks Atomic thinks you\u2019ll love',
        items: flat,
        type: 'TRACK',
        accent: 'cyan',
      });
    }
  } catch (e) {
    console.warn('AI rec (picked tracks) failed', e);
  }

  // Mood / discovery row — pick 2 moods based on library size
  try {
    const seed = likedSongs.length + recentlyPlayed.length;
    const moodSample = [MOODS[seed % MOODS.length], MOODS[(seed + 3) % MOODS.length]];
    const results = await Promise.all(moodSample.map(async (m) => {
      try {
        const r = await searchAll(m);
        return { mood: m, playlists: r.playlists.slice(0, 6) };
      } catch { return { mood: m, playlists: [] }; }
    }));
    results.forEach((r, i) => {
      if (r.playlists.length) {
        sections.push({
          id: `mood-${i}`,
          title: `Mood: ${r.mood.replace(/\b\w/g, c => c.toUpperCase())}`,
          subtitle: 'Discover based on your vibe',
          items: r.playlists,
          type: 'PLAYLIST',
          accent: (['pink', 'amber'] as const)[i % 2],
        });
      }
    });
  } catch (e) {
    console.warn('AI rec (mood) failed', e);
  }

  // Fallback when library is completely empty
  if (sections.length === 0) {
    try {
      const r = await searchAll(FALLBACK_QUERIES[0]);
      if (r.playlists.length) {
        sections.push({
          id: 'fallback-top',
          title: 'Start exploring',
          subtitle: 'Popular now',
          items: r.playlists.slice(0, 6),
          type: 'PLAYLIST',
          accent: 'cyan',
        });
      }
      if (r.albums.length) {
        sections.push({
          id: 'fallback-albums',
          title: 'Trending albums',
          items: r.albums.slice(0, 6),
          type: 'ALBUM',
          accent: 'violet',
        });
      }
    } catch (e) {
      console.warn('AI rec fallback failed', e);
    }
  }

  sessionCache.set(cacheKey, sections);
  return sections;
}

export const clearRecommendationCache = () => sessionCache.clear();

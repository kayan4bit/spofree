import React, { useEffect, useState, useRef } from 'react';
import { Search, Mic2, Loader2, Rss, Play, Plus, Check, ChevronLeft, Download } from 'lucide-react';
import {
  Podcast, Episode,
  searchPodcasts, topPodcasts, getEpisodes,
  podcastLibrary, recentEpisodes,
  episodeToTrack,
} from '../services/podcastService';

interface PodcastViewProps {
  onPlayEpisode: (track: any, context: any[]) => void;
  accentColor: string;
}

const formatDuration = (s: number) => {
  if (!s || isNaN(s)) return '—';
  const m = Math.floor(s / 60);
  if (m >= 60) return `${Math.floor(m / 60)}h ${m % 60}m`;
  return `${m} min`;
};

const formatDate = (raw: string) => {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return raw.slice(0, 16);
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
};

export const PodcastView: React.FC<PodcastViewProps> = ({ onPlayEpisode, accentColor }) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Podcast[] | null>(null);
  const [top, setTop] = useState<Podcast[]>([]);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [loadingTop, setLoadingTop] = useState(true);
  const [selected, setSelected] = useState<Podcast | null>(null);
  const [episodes, setEpisodes] = useState<Episode[]>([]);
  const [loadingEps, setLoadingEps] = useState(false);
  const [subs, setSubs] = useState<Podcast[]>(podcastLibrary.list());
  const [recents, setRecents] = useState<Episode[]>(recentEpisodes.list());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let mounted = true;
    topPodcasts().then(list => { if (mounted) { setTop(list); setLoadingTop(false); } });
    return () => { mounted = false; };
  }, []);

  const runSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) { setResults(null); return; }
    setLoadingSearch(true);
    const list = await searchPodcasts(query, 40);
    setResults(list);
    setLoadingSearch(false);
  };

  const openPodcast = async (p: Podcast) => {
    setSelected(p);
    setEpisodes([]);
    setLoadingEps(true);
    const eps = await getEpisodes(p);
    setEpisodes(eps);
    setLoadingEps(false);
  };

  const toggleSub = (p: Podcast) => {
    if (podcastLibrary.isSubscribed(p.id)) {
      podcastLibrary.unsubscribe(p.id);
    } else {
      podcastLibrary.subscribe(p);
    }
    setSubs(podcastLibrary.list());
  };

  const playEpisode = (ep: Episode, context: Episode[]) => {
    const track = episodeToTrack(ep);
    const queue = context.map(episodeToTrack);
    recentEpisodes.add(ep);
    setRecents(recentEpisodes.list());
    onPlayEpisode(track, queue);
  };

  if (selected) {
    const isSubbed = subs.some(s => s.id === selected.id);
    return (
      <div className="animate-fade-in">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-2 text-[color:var(--text-secondary)] hover:text-white mb-4"
        >
          <ChevronLeft size={18} /> Back to podcasts
        </button>

        <div className="flex flex-col md:flex-row gap-6 mb-6">
          <img
            src={selected.artwork}
            alt={selected.title}
            className="w-48 h-48 rounded-xl shadow-2xl object-cover self-start"
            onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Podcast'; }}
          />
          <div className="flex-1 flex flex-col justify-end">
            <span className="text-xs uppercase tracking-widest text-[color:var(--text-secondary)]">Podcast</span>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight leading-tight mb-1">{selected.title}</h1>
            <p className="text-[color:var(--text-secondary)]">{selected.author}</p>
            {selected.genre && <p className="text-xs text-[color:var(--text-secondary)] mt-1">{selected.genre}</p>}
            <div className="flex items-center gap-2 mt-4">
              <button
                onClick={() => toggleSub(selected)}
                className="atomic-chip px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2"
                style={isSubbed ? { background: accentColor, color: '#000' } : undefined}
              >
                {isSubbed ? <><Check size={16}/> Subscribed</> : <><Plus size={16}/> Subscribe</>}
              </button>
              <a
                href={selected.feedUrl}
                target="_blank"
                rel="noreferrer"
                className="atomic-chip px-4 py-2 rounded-full text-sm font-semibold flex items-center gap-2"
              >
                <Rss size={16}/> RSS
              </a>
            </div>
          </div>
        </div>

        {loadingEps ? (
          <div className="flex items-center gap-2 text-[color:var(--text-secondary)]"><Loader2 size={16} className="animate-spin"/> Loading episodes…</div>
        ) : episodes.length === 0 ? (
          <div className="atomic-card p-6 text-center text-[color:var(--text-secondary)]">
            Couldn't load episodes. The RSS feed may be private or blocked by CORS.
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {episodes.map((ep, i) => (
              <div
                key={ep.id}
                className="group flex items-start gap-3 p-3 rounded-lg hover:bg-white/5 transition-colors"
              >
                <button
                  onClick={() => playEpisode(ep, episodes)}
                  className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-1"
                  style={{ background: `linear-gradient(135deg, ${accentColor}, #a855f7)` }}
                  aria-label={`Play ${ep.title}`}
                >
                  <Play size={16} fill="white" className="text-white ml-0.5"/>
                </button>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate">{ep.title}</div>
                  <div className="text-xs text-[color:var(--text-secondary)] mb-1">
                    {formatDate(ep.pubDate)} · {formatDuration(ep.duration)}
                  </div>
                  {ep.description && (
                    <div className="text-sm text-[color:var(--text-secondary)] line-clamp-2 max-w-3xl">
                      {ep.description}
                    </div>
                  )}
                </div>
                <a
                  href={ep.audioUrl}
                  target="_blank"
                  rel="noreferrer"
                  download
                  className="opacity-0 group-hover:opacity-100 text-[color:var(--text-secondary)] hover:text-white self-center"
                  title="Download episode"
                >
                  <Download size={18} />
                </a>
                <div className="text-xs text-[color:var(--text-secondary)] self-center w-10 text-right">{i + 1}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <div className="mb-2 flex items-center gap-3">
        <Mic2 size={28} style={{ color: accentColor }} />
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight atomic-gradient-text">Podcasts</h1>
      </div>
      <p className="text-sm text-[color:var(--text-secondary)] mb-6">
        Search any podcast in the world. Streams and downloads the real RSS feed.
      </p>

      <form onSubmit={runSearch} className="relative max-w-xl mb-8">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        <input
          ref={searchRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search podcasts…"
          data-search-input="true"
          className="h-11 w-full rounded-full pl-10 pr-24 bg-[#242424] text-sm text-white focus:outline-none"
        />
        <button
          type="submit"
          className="absolute right-1 top-1/2 -translate-y-1/2 h-9 px-4 rounded-full text-sm font-semibold"
          style={{ background: accentColor, color: '#000' }}
        >
          {loadingSearch ? <Loader2 size={16} className="animate-spin" /> : 'Search'}
        </button>
      </form>

      {subs.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Your Subscriptions</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {subs.map(p => (
              <PodcastCard key={p.id} podcast={p} onOpen={openPodcast} />
            ))}
          </div>
        </section>
      )}

      {recents.length > 0 && (
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Recently Played</h2>
          <div className="flex flex-col gap-1">
            {recents.slice(0, 6).map(ep => (
              <button
                key={ep.id}
                onClick={() => playEpisode(ep, recents)}
                className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 text-left"
              >
                <img src={ep.podcastArtwork} alt="" className="w-10 h-10 rounded object-cover" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold truncate">{ep.title}</div>
                  <div className="text-xs text-[color:var(--text-secondary)] truncate">{ep.podcastTitle}</div>
                </div>
                <Play size={16} className="text-[color:var(--text-secondary)]" />
              </button>
            ))}
          </div>
        </section>
      )}

      {results && (
        <section className="mb-10">
          <h2 className="text-xl font-bold mb-4">Search Results</h2>
          {loadingSearch ? (
            <div className="flex items-center gap-2 text-[color:var(--text-secondary)]"><Loader2 size={16} className="animate-spin"/> Searching…</div>
          ) : results.length === 0 ? (
            <div className="text-sm text-[color:var(--text-secondary)]">No results.</div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {results.map(p => <PodcastCard key={p.id} podcast={p} onOpen={openPodcast} />)}
            </div>
          )}
        </section>
      )}

      <section>
        <h2 className="text-xl font-bold mb-4">Top Podcasts</h2>
        {loadingTop ? (
          <div className="flex items-center gap-2 text-[color:var(--text-secondary)]"><Loader2 size={16} className="animate-spin"/> Loading…</div>
        ) : top.length === 0 ? (
          <div className="text-sm text-[color:var(--text-secondary)]">Top chart unavailable.</div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
            {top.map(p => <PodcastCard key={p.id} podcast={p} onOpen={openPodcast} />)}
          </div>
        )}
      </section>
    </div>
  );
};

const PodcastCard: React.FC<{ podcast: Podcast; onOpen: (p: Podcast) => void }> = ({ podcast, onOpen }) => (
  <button
    onClick={() => onOpen(podcast)}
    className="atomic-card p-3 text-left group hover:-translate-y-0.5 transition-transform"
  >
    <div className="relative mb-3">
      <img
        src={podcast.artwork}
        alt={podcast.title}
        className="aspect-square w-full rounded-lg object-cover shadow-lg"
        onError={(e) => { (e.target as HTMLImageElement).src = 'https://via.placeholder.com/300?text=Podcast'; }}
      />
    </div>
    <div className="font-semibold text-sm truncate">{podcast.title}</div>
    <div className="text-xs text-[color:var(--text-secondary)] truncate">{podcast.author}</div>
  </button>
);

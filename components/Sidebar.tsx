import React from 'react';
import { Home, Search, Library, PlusSquare, Heart, Globe, Settings, Sparkles } from 'lucide-react';
import { ViewState, Playlist } from '../types';
import { APP_NAME } from '../constants';

interface SidebarProps {
  currentView: ViewState;
  onChangeView: (view: ViewState) => void;
  playlists: Playlist[];
  onPlaylistClick: (playlist: Playlist) => void;
  onCreatePlaylist: () => void;
  onLikedSongsClick: () => void;
  onOpenSettings: () => void;
  connected?: boolean;
  accentColor?: string;
}

export const AtomicLogo: React.FC<{ size?: number; accent?: string; animated?: boolean }> = ({
  size = 28,
  accent = '#22d3ee',
  animated = true,
}) => (
  <svg width={size} height={size} viewBox="0 0 64 64" className="block" aria-hidden>
    <defs>
      <linearGradient id="atomicGrad" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0%" stopColor={accent} />
        <stop offset="55%" stopColor="#a855f7" />
        <stop offset="100%" stopColor="#f472b6" />
      </linearGradient>
    </defs>
    {/* nucleus */}
    <circle cx="32" cy="32" r="5" fill="url(#atomicGrad)">
      {animated && (
        <animate attributeName="r" values="4.5;5.5;4.5" dur="2.4s" repeatCount="indefinite" />
      )}
    </circle>
    {/* orbits */}
    <g fill="none" stroke="url(#atomicGrad)" strokeWidth="2" opacity="0.85">
      <ellipse cx="32" cy="32" rx="26" ry="10" />
      <ellipse cx="32" cy="32" rx="26" ry="10" transform="rotate(60 32 32)" />
      <ellipse cx="32" cy="32" rx="26" ry="10" transform="rotate(120 32 32)" />
    </g>
  </svg>
);

export const Sidebar: React.FC<SidebarProps> = ({
  currentView, onChangeView, playlists, onPlaylistClick, onCreatePlaylist, onLikedSongsClick, onOpenSettings,
  connected = true, accentColor = '#22d3ee',
}) => {
  const NavItem = ({ view, icon: Icon, label }: { view: ViewState, icon: React.ElementType, label: string }) => {
    const active = currentView === view;
    return (
      <button
        onClick={() => onChangeView(view)}
        className={`flex items-center gap-4 px-4 py-2 rounded-md transition-all duration-200 w-full text-left ${
          active ? 'text-white bg-white/5' : 'text-[color:var(--text-secondary)] hover:text-white hover:bg-white/5'
        }`}
      >
        <Icon size={22} strokeWidth={active ? 2.5 : 2} />
        <span className="font-semibold text-sm truncate">{label}</span>
        {active && <span className="ml-auto h-5 w-1 rounded-full" style={{ background: `linear-gradient(180deg, ${accentColor}, #a855f7)` }} />}
      </button>
    );
  };

  return (
    <div className="w-64 atomic-glass-strong h-full flex-col pt-5 gap-2 hidden md:flex border-r border-[color:var(--border-subtle)] pb-32">
      {/* Logo Area */}
      <div className="px-5 mb-3 flex items-center gap-3">
        <AtomicLogo size={30} accent={accentColor} />
        <div className="flex flex-col leading-tight">
          <span className="font-bold text-lg tracking-tight atomic-gradient-text">{APP_NAME}</span>
          <span className="text-[10px] uppercase tracking-widest text-[color:var(--text-secondary)]">Hi-Res · AI</span>
        </div>
      </div>

      {/* Main Nav */}
      <nav className="flex flex-col gap-1 px-2">
        <NavItem view={ViewState.HOME} icon={Home} label="Home" />
        <NavItem view={ViewState.SEARCH} icon={Search} label="Search" />
        <NavItem view={ViewState.LIBRARY} icon={Library} label="Your Library" />
      </nav>

      {/* Spacer / Secondary Actions */}
      <div className="mt-4 px-2 flex flex-col gap-1">
        <button
          onClick={onCreatePlaylist}
          className="flex items-center gap-4 px-4 py-2 rounded-md text-[color:var(--text-secondary)] hover:text-white hover:bg-white/5 transition-all"
        >
          <div className="p-1 rounded-sm bg-white/10">
            <PlusSquare size={18} />
          </div>
          <span className="font-semibold text-sm">Create Playlist</span>
        </button>
        <button
          onClick={onLikedSongsClick}
          className={`flex items-center gap-4 px-4 py-2 rounded-md transition-all ${
            currentView === ViewState.LIKED_SONGS ? 'text-white bg-white/5' : 'text-[color:var(--text-secondary)] hover:text-white hover:bg-white/5'
          }`}
        >
          <div
            className="p-1 rounded-sm"
            style={{ background: `linear-gradient(135deg, ${accentColor}, #a855f7)` }}
          >
            <Heart size={18} className="text-white" fill="white" />
          </div>
          <span className="font-semibold text-sm">Liked Songs</span>
        </button>
      </div>

      <div className="border-t border-[color:var(--border-subtle)] mx-6 my-3"></div>

      {/* Scrollable Playlist List */}
      <div className="flex-1 overflow-y-auto px-6 py-2">
        {playlists.length === 0 ? (
          <div className="text-xs text-[color:var(--text-secondary)] opacity-70">Your playlists will appear here.</div>
        ) : (
          <ul className="flex flex-col gap-2.5">
            {playlists.map((playlist) => (
              <li
                key={playlist.uuid}
                onClick={() => onPlaylistClick(playlist)}
                className="text-[color:var(--text-secondary)] hover:text-white text-sm cursor-pointer truncate transition-colors"
              >
                {playlist.title}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Bottom Actions */}
      <div className="px-4 mt-auto flex flex-col gap-2">
        <button
          onClick={onOpenSettings}
          className="flex items-center gap-3 px-4 py-3 text-sm font-semibold atomic-chip rounded-md w-full"
        >
          <Settings size={18} />
          <span>Settings</span>
        </button>

        <div className="flex items-center justify-center gap-2 text-[11px] text-[color:var(--text-secondary)] pt-2">
          <Globe size={12} className={connected ? 'text-emerald-400' : 'text-rose-400'} />
          <span>{connected ? 'HiFi API Connected' : 'API Offline'}</span>
          <Sparkles size={12} className="text-violet-300 ml-1" />
          <span>AI Ready</span>
        </div>
      </div>
    </div>
  );
};

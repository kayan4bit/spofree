
import React, { useEffect, useRef, useState } from 'react';
import { Play, Pause, SkipBack, SkipForward, Repeat, Shuffle, Volume2, Volume1, VolumeX, Download, Heart, Repeat1, ChevronDown, Loader2, Mic2, ListMusic, Maximize2, Share2, Sliders, Radio as RadioIcon } from 'lucide-react';
import { Track, RepeatMode } from '../types';
import { storageService } from '../services/storageService';
import { TrackList } from './TrackList';
import { Visualizer } from './Visualizer';
import { DEFAULT_VOLUME } from '../constants';
import { audioEngine } from '../services/audioEngine';
import { EqualizerPanel } from './EqualizerPanel';
import { notifyTrack, ensureNotificationPermission } from '../services/notificationService';

interface PlayerProps {
  currentTrack: Track | null;
  isPlaying: boolean;
  onPlayPause: () => void;
  onNext: () => void;
  onPrev: () => void;
  isShuffling: boolean;
  repeatMode: RepeatMode;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  
  onArtistClick: (artistId: string | number) => void;
  onQualityClick: () => void;
  onDownload: () => void;

  // Settings Props
  accentColor: string;
  showVisualizer: boolean;
  showStats: boolean;
  sleepTimer: number | null;
  setSleepTimer: (m: number | null) => void;
  highPerformanceMode: boolean;
  disableGlow: boolean;

  // Sidebar Toggles
  showQueue: boolean;
  toggleQueue: () => void;
  showLyrics: boolean;
  toggleLyrics: () => void;

  // Queue Data
  queue: Track[];
  onPlayTrack: (track: Track) => void;

  // Focus / radio / share
  focusMode?: boolean;
  setFocusMode?: (v: boolean) => void;
  onRadio?: () => void;
  desktopNotifications?: boolean;
}

const formatTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

export const Player: React.FC<PlayerProps> = ({ 
    currentTrack, isPlaying, onPlayPause, onNext, onPrev,
    isShuffling, repeatMode, onToggleShuffle, onToggleRepeat,
    onArtistClick, onQualityClick, onDownload,
    accentColor, showVisualizer, showStats, sleepTimer, setSleepTimer, highPerformanceMode, disableGlow,
    showQueue, toggleQueue, showLyrics, toggleLyrics,
    queue, onPlayTrack
}) => {
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState<number>(() => {
    try {
      const stored = parseFloat(localStorage.getItem('atomic_volume') || '');
      if (!isNaN(stored) && stored >= 0 && stored <= 1) return stored;
    } catch {}
    return DEFAULT_VOLUME;
  });
  const [preMuteVolume, setPreMuteVolume] = useState<number>(DEFAULT_VOLUME);
  const [duration, setDuration] = useState(0);
  const [isLiked, setIsLiked] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  
  // Audio Ref
  const audioRef = useRef<HTMLAudioElement>(null);
  const [analyser, setAnalyser] = useState<AnalyserNode | null>(null);
  const [showEq, setShowEq] = useState(false);
  const [playbackRate, setPlaybackRateState] = useState<number>(() => audioEngine.getPlaybackRate());

  // Sleep Timer Ref
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (currentTrack) {
        setIsLiked(storageService.isLiked(currentTrack.id));
    }
  }, [currentTrack]);

  // Handle Play/Pause from props
  useEffect(() => {
      if (audioRef.current) {
          if (isPlaying) {
              audioEngine.resume();
              const playPromise = audioRef.current.play();
              if (playPromise !== undefined) {
                  playPromise.catch(error => {
                      console.error("Autoplay prevented or failed", error);
                  });
              }
          } else {
              audioRef.current.pause();
          }
      }
  }, [isPlaying, currentTrack]);

  // Desktop notification on track change
  useEffect(() => {
      if (currentTrack && isPlaying) notifyTrack(currentTrack);
  }, [currentTrack?.id, isPlaying]);

  // Keep audio element's playbackRate in sync
  useEffect(() => {
      if (audioRef.current) audioRef.current.playbackRate = playbackRate;
  }, [playbackRate, currentTrack?.streamUrl]);

  // Listen for global playback-rate change events (from EQ panel)
  useEffect(() => {
      const h = () => setPlaybackRateState(audioEngine.getPlaybackRate());
      window.addEventListener('atomic:rate', h);
      return () => window.removeEventListener('atomic:rate', h);
  }, []);

  // Initialize Audio Engine (EQ + analyser). iOS handles it too since the engine
  // gracefully degrades and runs on unlock via user-gesture.
  useEffect(() => {
      if (!audioRef.current) return;
      const an = audioEngine.init(audioRef.current);
      if (an) setAnalyser(an);
  }, [audioRef.current]);

  // Sleep Timer Logic with gradual fade-out over the last 20 seconds
  useEffect(() => {
      if (timerRef.current) clearTimeout(timerRef.current);
      if (fadeRef.current) clearInterval(fadeRef.current);
      if (!sleepTimer) return;

      const totalMs = sleepTimer * 60 * 1000;
      const fadeMs = Math.min(20_000, totalMs);
      const startFadeAt = totalMs - fadeMs;
      const startVolume = audioRef.current?.volume ?? volume;

      timerRef.current = setTimeout(() => {
          const steps = 40;
          const stepMs = fadeMs / steps;
          let i = 0;
          fadeRef.current = setInterval(() => {
              i++;
              if (audioRef.current) {
                  audioRef.current.volume = Math.max(0, startVolume * (1 - i / steps));
              }
              if (i >= steps) {
                  if (fadeRef.current) clearInterval(fadeRef.current);
                  onPlayPause();
                  if (audioRef.current) audioRef.current.volume = startVolume;
                  setSleepTimer(null);
              }
          }, stepMs);
      }, startFadeAt);
  }, [sleepTimer]);

  // Media Session API Support
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: currentTrack.title,
            artist: currentTrack.artist.name,
            album: currentTrack.album.title,
            artwork: [
                { src: currentTrack.album.cover, sizes: '512x512', type: 'image/jpeg' }
            ]
        });

        navigator.mediaSession.setActionHandler('play', onPlayPause);
        navigator.mediaSession.setActionHandler('pause', onPlayPause);
        navigator.mediaSession.setActionHandler('previoustrack', onPrev);
        navigator.mediaSession.setActionHandler('nexttrack', onNext);
    }
  }, [currentTrack, onPlayPause, onPrev, onNext]);

  const handleTimeUpdate = () => {
      if (audioRef.current) {
          setProgress(audioRef.current.currentTime);
          setDuration(audioRef.current.duration || 0);
      }
  };

  const handleEnded = () => {
      onNext();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
      const time = parseFloat(e.target.value);
      if (audioRef.current) {
          audioRef.current.currentTime = time;
          setProgress(time);
      }
  };

  // Sync volume to the <audio> element on mount, track change, and any volume update
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
    try { localStorage.setItem('atomic_volume', String(volume)); } catch {}
  }, [volume, currentTrack?.streamUrl]);

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const vol = parseFloat(e.target.value);
    setVolume(vol);
    if (vol > 0) setPreMuteVolume(vol);
  };

  const toggleMute = () => {
    if (volume === 0) {
      setVolume(preMuteVolume || DEFAULT_VOLUME);
    } else {
      setPreMuteVolume(volume);
      setVolume(0);
    }
  };

  const toggleLike = () => {
      if (!currentTrack) return;
      storageService.toggleLikeSong(currentTrack);
      setIsLiked(!isLiked);
  };

  // Listen for global keyboard-driven mute toggle (from App.tsx).
  useEffect(() => {
      const h = () => toggleMute();
      window.addEventListener('atomic:toggle-mute', h);
      return () => window.removeEventListener('atomic:toggle-mute', h);
  }, [volume, preMuteVolume]);

  // Listen for global keyboard shortcut to open EQ
  useEffect(() => {
      const h = () => setShowEq(true);
      window.addEventListener('atomic:open-eq', h);
      return () => window.removeEventListener('atomic:open-eq', h);
  }, []);

  const handleShare = async () => {
      if (!currentTrack) return;
      const url = `https://tidal.com/browse/track/${currentTrack.id}`;
      const shareData = {
          title: currentTrack.title,
          text: `${currentTrack.title} — ${currentTrack.artist.name}`,
          url,
      };
      try {
          if (navigator.share) {
              await navigator.share(shareData);
              return;
          }
      } catch {}
      try {
          await navigator.clipboard.writeText(url);
      } catch {}
  };

  if (!currentTrack) return null;

  return (
    <>
    <audio 
        ref={audioRef}
        src={currentTrack.streamUrl}
        crossOrigin="anonymous"
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => setIsBuffering(false)}
        onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
    />
    {showEq && <EqualizerPanel onClose={() => setShowEq(false)} accentColor={accentColor} />}

    {/* Expanded Full Screen Player */}
    {isExpanded && (
        <div className="fixed inset-0 z-[60] bg-[#121212] overflow-y-auto animate-slide-up no-scrollbar">
             {/* Background Glow */}
             {!disableGlow && (
                <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden fixed">
                    <img src={currentTrack.album.cover} className="w-full h-full object-cover blur-3xl opacity-30 scale-110" />
                </div>
             )}

             {/* Header */}
             <div className="sticky top-0 z-30 flex justify-between items-center p-6 bg-gradient-to-b from-black/50 to-transparent">
                <button onClick={() => setIsExpanded(false)} className="text-white p-2 rounded-full hover:bg-white/10"><ChevronDown /></button>
                <div className="flex flex-col items-center">
                    <span className="text-xs font-bold tracking-widest uppercase text-white/60">Now Playing</span>
                    <span className="font-bold">{currentTrack.album.title}</span>
                </div>
                <button onClick={toggleLyrics} className={`p-2 rounded-full hover:bg-white/10 ${showLyrics ? 'text-green-500' : 'text-white/60'}`}><Mic2 /></button>
             </div>

             {showLyrics ? (
                /* Full Screen Lyrics View */
                <div className="relative z-10 flex flex-col items-center justify-center p-8 min-h-[calc(100vh-100px)] text-center">
                    <div className="max-w-xl space-y-8 animate-fade-in">
                        <div className="flex flex-col gap-2 mb-8">
                            <h1 className="text-3xl font-bold">{currentTrack.title}</h1>
                            <h2 className="text-xl text-white/70">{currentTrack.artist.name}</h2>
                        </div>
                        <div className="space-y-8 text-2xl md:text-4xl font-bold text-white/50 leading-relaxed">
                            <p className="text-white scale-105 transition-transform" style={{ textShadow: `0 0 30px ${accentColor}60` }}>
                                (Instrumental or Lyrics not available)
                            </p>
                            <p>We're still working on fetching<br/>real-time lyrics for this track.</p>
                            <p>Just enjoy the vibe<br/>for now.</p>
                            <p>♫ ♫ ♫</p>
                        </div>
                    </div>
                </div>
             ) : (
                /* Standard Controls View */
                <div className="flex flex-col min-h-[calc(100vh-80px)]">
                    <div className="relative z-10 flex-1 flex flex-col md:flex-row items-center justify-center gap-8 md:gap-20 p-8">
                        {/* Visualizer / Artwork */}
                        <div className="w-full max-w-md aspect-square relative group">
                            <img src={currentTrack.album.cover} className={`w-full h-full object-cover shadow-2xl rounded-lg ${isPlaying && !highPerformanceMode ? 'animate-pulse-slow' : ''}`} />
                            {showVisualizer && analyser && (
                                <div className="absolute inset-0 z-20 opacity-80 pointer-events-none mix-blend-screen rounded-lg overflow-hidden">
                                    <Visualizer analyser={analyser} isPlaying={isPlaying} accentColor={accentColor} />
                                </div>
                            )}
                        </div>

                        {/* Info & Controls */}
                        <div className="w-full max-w-md flex flex-col gap-6">
                            <div className="flex justify-between items-end">
                                <div>
                                    <h1 className="text-3xl font-bold mb-2 cursor-pointer hover:underline" onClick={() => { setIsExpanded(false); onArtistClick(currentTrack.artist.id); }}>{currentTrack.title}</h1>
                                    <h2 className="text-xl text-white/70 cursor-pointer hover:underline" onClick={() => { setIsExpanded(false); onArtistClick(currentTrack.artist.id); }}>{currentTrack.artist.name}</h2>
                                </div>
                                <div className="flex items-center gap-4">
                                    <button onClick={() => setShowEq(true)} className="text-white/50 hover:text-white transition-transform active:scale-90" title="Equalizer (E)">
                                        <Sliders size={28} />
                                    </button>
                                    <button onClick={handleShare} className="text-white/50 hover:text-white transition-transform active:scale-90" title="Share track">
                                        <Share2 size={28} />
                                    </button>
                                    <button onClick={onDownload} className="text-white/50 hover:text-white transition-transform active:scale-90" title="Download">
                                        <Download size={32} />
                                    </button>
                                    <button onClick={toggleLike} className={`transition-transform active:scale-90 ${isLiked ? 'text-green-500' : 'text-white/50 hover:text-white'}`}>
                                        <Heart size={32} fill={isLiked ? "currentColor" : "none"} />
                                    </button>
                                </div>
                            </div>

                            {/* Progress */}
                            <div className="flex flex-col gap-2 group">
                                <input 
                                    type="range" 
                                    min="0" 
                                    max={duration || 100} 
                                    value={progress} 
                                    onChange={handleSeek}
                                    className="w-full h-1 bg-white/20 rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3 [&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white group-hover:[&::-webkit-slider-thumb]:scale-125 transition-all"
                                    style={{ backgroundImage: `linear-gradient(${accentColor}, ${accentColor})`, backgroundSize: `${(progress / duration) * 100}% 100%`, backgroundRepeat: 'no-repeat' }}
                                />
                                <div className="flex justify-between text-xs font-medium text-white/50">
                                    <span>{formatTime(progress)}</span>
                                    <span>{formatTime(duration)}</span>
                                </div>
                            </div>

                            {/* Main Controls */}
                            <div className="flex items-center justify-between">
                                <button onClick={onToggleShuffle} className={`p-2 rounded-full transition-colors ${isShuffling ? 'text-green-500' : 'text-white/50 hover:text-white'}`}>
                                    <Shuffle size={24} />
                                </button>
                                <button onClick={onPrev} className="p-2 text-white/70 hover:text-white transition-colors"><SkipBack size={32} /></button>
                                <button 
                                    onClick={onPlayPause} 
                                    className="w-16 h-16 rounded-full bg-white text-black flex items-center justify-center hover:scale-105 active:scale-95 transition-all shadow-lg"
                                >
                                    {isBuffering ? <Loader2 className="animate-spin" /> : (isPlaying ? <Pause size={32} fill="black" /> : <Play size={32} fill="black" className="ml-1" />)}
                                </button>
                                <button onClick={onNext} className="p-2 text-white/70 hover:text-white transition-colors"><SkipForward size={32} /></button>
                                <button onClick={onToggleRepeat} className={`p-2 rounded-full transition-colors ${repeatMode !== 'OFF' ? 'text-green-500' : 'text-white/50 hover:text-white'}`}>
                                    {repeatMode === 'ONE' ? <Repeat1 size={24} /> : <Repeat size={24} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Queue Section in Expanded View */}
                    <div className="relative z-10 w-full max-w-3xl mx-auto p-6 pb-20">
                        <h3 className="text-xl font-bold mb-4">Next Up</h3>
                        <div className="bg-white/5 rounded-xl p-4">
                            <TrackList 
                                tracks={queue} 
                                onPlay={onPlayTrack}
                                currentTrackId={currentTrack.id}
                                accentColor={accentColor}
                                hideHeader={true}
                                compactMode={true}
                            />
                            {queue.length === 0 && <div className="text-center text-white/50 py-4">Queue is empty</div>}
                        </div>
                    </div>
                </div>
             )}
        </div>
    )}

    {/* Bottom Bar Player */}
    {/* Only show if NOT expanded to avoid duplicate controls and z-index issues */}
    {!isExpanded && (
        <div className="fixed bottom-[calc(56px+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 atomic-glass-strong border-t border-[color:var(--border-subtle)] h-20 px-4 flex items-center justify-between z-50 transition-transform duration-300">
            {/* Track Info */}
            <div className="flex items-center gap-4 flex-1 min-w-0 md:flex-none md:w-[30%] md:min-w-[180px]">
                <div className="relative group cursor-pointer flex-shrink-0" onClick={() => setIsExpanded(true)}>
                    <img src={currentTrack.album.cover} className="w-14 h-14 rounded object-cover shadow-md" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity rounded">
                        <Maximize2 size={20} className="text-white" />
                    </div>
                </div>
                <div className="flex flex-col min-w-0">
                    <span className="font-bold text-sm text-white truncate hover:underline cursor-pointer" onClick={() => onArtistClick(currentTrack.artist.id)}>{currentTrack.title}</span>
                    <span className="text-xs text-[#b3b3b3] truncate hover:underline cursor-pointer" onClick={() => onArtistClick(currentTrack.artist.id)}>{currentTrack.artist.name}</span>
                </div>
                <button onClick={toggleLike} className={`hidden md:block transition-transform active:scale-90 ${isLiked ? 'text-green-500' : 'text-[#b3b3b3] hover:text-white'}`}>
                    <Heart size={18} fill={isLiked ? "currentColor" : "none"} />
                </button>
            </div>

            {/* Center Controls */}
            <div className="flex flex-col items-center flex-none md:flex-1 md:max-w-[40%] gap-1">
                <div className="flex items-center gap-4">
                    <button onClick={onToggleShuffle} className={`hidden md:block p-2 ${isShuffling ? 'text-green-500' : 'text-[#b3b3b3] hover:text-white'}`}>
                        <Shuffle size={16} />
                    </button>
                    <button onClick={onPrev} className="text-[#b3b3b3] hover:text-white"><SkipBack size={20} fill="currentColor" /></button>
                    <button onClick={onPlayPause} aria-label={isPlaying ? 'Pause' : 'Play'} className="w-9 h-9 rounded-full bg-white text-black flex items-center justify-center hover:scale-110 transition-transform shadow-[0_0_24px_rgba(255,255,255,0.25)]" style={{ boxShadow: `0 0 24px ${accentColor}55` }}>
                        {isBuffering ? <Loader2 size={16} className="animate-spin" /> : (isPlaying ? <Pause size={16} fill="black" /> : <Play size={16} fill="black" className="ml-0.5" />)}
                    </button>
                    <button onClick={onNext} className="text-[#b3b3b3] hover:text-white"><SkipForward size={20} fill="currentColor" /></button>
                    <button onClick={onToggleRepeat} className={`hidden md:block p-2 ${repeatMode !== 'OFF' ? 'text-green-500' : 'text-[#b3b3b3] hover:text-white'}`}>
                        {repeatMode === 'ONE' ? <Repeat1 size={16} /> : <Repeat size={16} />}
                    </button>
                </div>
                <div className="flex items-center gap-2 w-full max-w-md">
                    <span className="text-[10px] text-[#b3b3b3] tabular-nums hidden sm:block">{formatTime(progress)}</span>
                    <input 
                        type="range" 
                        min="0" 
                        max={duration || 100} 
                        value={progress} 
                        onChange={handleSeek}
                        className="flex-1 h-1 bg-[#4d4d4d] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0 hover:[&::-webkit-slider-thumb]:w-3 hover:[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white transition-all"
                        style={{ backgroundImage: `linear-gradient(${accentColor}, ${accentColor})`, backgroundSize: `${(progress / duration) * 100}% 100%`, backgroundRepeat: 'no-repeat' }}
                    />
                    <span className="text-[10px] text-[#b3b3b3] tabular-nums hidden sm:block">{formatTime(duration)}</span>
                </div>
            </div>

            {/* Right Controls */}
            <div className="flex items-center justify-end gap-2 w-auto md:w-[30%] md:min-w-[180px]">
                {showStats && (
                    <div className="hidden lg:flex flex-col text-[9px] text-green-500 mr-2 bg-black/50 p-1 rounded font-mono">
                        <span>BUF: {isBuffering ? 'YES' : 'NO'}</span>
                        <span>TIME: {Math.round(progress)}/{Math.round(duration)}</span>
                    </div>
                )}
                <button onClick={() => setShowEq(true)} className="hidden md:block p-2 hover:text-white text-[#b3b3b3]" title="Equalizer (E)"><Sliders size={18} /></button>
                <button onClick={handleShare} className="hidden md:block p-2 hover:text-white text-[#b3b3b3]" title="Share"><Share2 size={18} /></button>
                <button onClick={onDownload} className="hidden md:block p-2 hover:text-white text-[#b3b3b3]" title="Download"><Download size={18} /></button>
                <button onClick={toggleLyrics} className={`hidden md:block p-2 hover:text-white ${showLyrics ? 'text-green-500' : 'text-[#b3b3b3]'}`} title="Lyrics"><Mic2 size={18} /></button>
                <button onClick={toggleQueue} className={`hidden md:block p-2 hover:text-white ${showQueue ? 'text-green-500' : 'text-[#b3b3b3]'}`} title="Queue"><ListMusic size={18} /></button>
                <div className="hidden md:flex items-center gap-2 group w-24 md:w-32">
                    <button onClick={toggleMute} className="text-[#b3b3b3] hover:text-white" title={volume === 0 ? 'Unmute' : 'Mute'}>
                        {volume === 0 ? <VolumeX size={18} /> : volume < 0.5 ? <Volume1 size={18} /> : <Volume2 size={18} />}
                    </button>
                    <input 
                        type="range" 
                        min="0" 
                        max="1" 
                        step="0.01" 
                        value={volume} 
                        onChange={handleVolumeChange}
                        className="w-full h-1 bg-[#4d4d4d] rounded-lg appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-0 [&::-webkit-slider-thumb]:h-0 group-hover:[&::-webkit-slider-thumb]:w-3 group-hover:[&::-webkit-slider-thumb]:h-3 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white transition-all"
                        style={{ backgroundImage: `linear-gradient(#fff, #fff)`, backgroundSize: `${volume * 100}% 100%`, backgroundRepeat: 'no-repeat' }}
                    />
                </div>
            </div>
        </div>
    )}
    </>
  );
};

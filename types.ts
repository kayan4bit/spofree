

export interface Artist {
  id: number | string;
  name: string;
  picture?: string;
  type?: string;
}

export interface Album {
  id: number | string;
  title: string;
  cover: string;
  artist?: Artist;
  releaseDate?: string;
}

export interface Playlist {
  uuid: string;
  title: string;
  description?: string;
  image: string;
  creator: { name: string };
  isLocal?: boolean; // Flag for user created playlists
  tracks?: Track[];
}

export interface Track {
  id: number | string;
  title: string;
  artist: Artist;
  album: Album;
  duration: number; // in seconds
  streamUrl?: string; // Direct URL if available
  quality?: 'LOW' | 'HIGH' | 'LOSSLESS' | 'HI_RES';
  lyrics?: string; // Synced lyrics or plain text
}

export type RepeatMode = 'OFF' | 'ALL' | 'ONE';

export interface PlayerState {
  currentTrack: Track | null;
  isPlaying: boolean;
  volume: number;
  progress: number;
  queue: Track[];
  isShuffling: boolean;
  repeatMode: RepeatMode;
}

export enum ViewState {
  HOME = 'HOME',
  SEARCH = 'SEARCH',
  LIBRARY = 'LIBRARY',
  ALBUM_DETAILS = 'ALBUM_DETAILS',
  ARTIST_DETAILS = 'ARTIST_DETAILS',
  PLAYLIST_DETAILS = 'PLAYLIST_DETAILS',
  LIKED_SONGS = 'LIKED_SONGS',
  PODCASTS = 'PODCASTS',
  PODCAST_DETAILS = 'PODCAST_DETAILS'
}

export interface SearchResult {
  tracks: Track[];
  albums: Album[];
  artists: Artist[];
  playlists: Playlist[];
}

export type AudioQuality = 'LOW' | 'HIGH' | 'LOSSLESS' | 'HI_RES';

export interface RecentlyPlayedItem {
  type: 'TRACK' | 'ALBUM' | 'ARTIST' | 'PLAYLIST';
  data: Track | Album | Artist | Playlist;
  timestamp: number;
}

export interface LocalStorageData {
  likedSongs: Track[];
  playlists: Playlist[];
  savedAlbums: Album[];
  followedArtists: Artist[];
  searchHistory: string[];
  audioQuality: AudioQuality;
  recentlyPlayed: RecentlyPlayedItem[];
  accentColor: string;
  showVisualizer: boolean;
  showStats: boolean;
  compactMode: boolean;
  reducedMotion: boolean;
  grayscaleMode: boolean;
  squareAvatars: boolean;
  highPerformanceMode: boolean;
  disableGlow: boolean;
  updateTitle: boolean;
}
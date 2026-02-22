import { createContext, useContext, useState, useCallback, useRef, useEffect, type ReactNode } from "react";
import { useAuth } from "../hooks/useAuth";

export interface PlaylistItem {
  id: string;
  title: string;
  audioUrl?: string;
}

export interface CurrentTrack {
  id: string;
  src: string;
  title: string;
}

interface AudioContextValue {
  currentTrack: CurrentTrack | null;
  isPlaying: boolean;
  generatingAudio: string | null;
  playlist: PlaylistItem[];
  play: (id: string, audioUrl: string, title: string, nextPlaylist?: PlaylistItem[]) => void;
  pause: () => void;
  setGenerating: (id: string | null) => void;
  getCachedUrl: (id: string) => string | undefined;
  setCachedUrl: (id: string, url: string) => void;
  refreshCurrentTrackUrl: (id: string, url: string) => void;
  skipNext: () => void;
  skipPrevious: () => void;
  hasNext: boolean;
  hasPrevious: boolean;
  setPlaylist: (items: PlaylistItem[]) => void;
  setPlaying: (playing: boolean) => void;
}

const AudioContext = createContext<AudioContextValue | null>(null);

export function AudioProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [currentTrack, setCurrentTrack] = useState<CurrentTrack | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [generatingAudio, setGenerating] = useState<string | null>(null);
  const [playlist, setPlaylistState] = useState<PlaylistItem[]>([]);
  const audioCacheRef = useRef<Record<string, string>>({});

  // Clear all audio state when user changes (logout or switch account) so the new user doesn't see or hear the previous user's briefing
  useEffect(() => {
    audioCacheRef.current = {};
    setCurrentTrack(null);
    setIsPlaying(false);
    setPlaylistState([]);
    setGenerating(null);
  }, [user?.email ?? null]);

  const getCachedUrl = useCallback((id: string) => audioCacheRef.current[id], []);
  const setCachedUrl = useCallback((id: string, url: string) => {
    audioCacheRef.current[id] = url;
  }, []);

  const refreshCurrentTrackUrl = useCallback((id: string, url: string) => {
    setCachedUrl(id, url);
    setCurrentTrack((prev) => (prev?.id === id ? { ...prev, src: url } : prev));
  }, [setCachedUrl]);

  const play = useCallback((id: string, audioUrl: string, title: string, nextPlaylist?: PlaylistItem[]) => {
    if (nextPlaylist?.length) setPlaylistState(nextPlaylist);
    if (audioUrl) setCachedUrl(id, audioUrl);
    const src = audioUrl || audioCacheRef.current[id];
    if (src) {
      setCurrentTrack({ id, src, title });
      setIsPlaying(true);
    }
  }, [setCachedUrl]);

  const pause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const currentIndex = currentTrack ? playlist.findIndex((p) => p.id === currentTrack.id) : -1;
  const hasNext = currentIndex >= 0 && currentIndex < playlist.length - 1;
  const hasPrevious = currentIndex > 0;

  const skipNext = useCallback(() => {
    if (currentIndex < 0 || currentIndex >= playlist.length - 1) return;
    const next = playlist[currentIndex + 1];
    const src = audioCacheRef.current[next.id] || next.audioUrl;
    if (src) {
      setCurrentTrack({ id: next.id, src, title: next.title });
      setIsPlaying(true);
    }
  }, [currentIndex, playlist]);

  const skipPrevious = useCallback(() => {
    if (currentIndex <= 0) return;
    const prev = playlist[currentIndex - 1];
    const src = audioCacheRef.current[prev.id] || prev.audioUrl;
    if (src) {
      setCurrentTrack({ id: prev.id, src, title: prev.title });
      setIsPlaying(true);
    }
  }, [currentIndex, playlist]);

  const setPlaylist = useCallback((items: PlaylistItem[]) => {
    setPlaylistState(items);
  }, []);

  const setPlaying = useCallback((playing: boolean) => {
    setIsPlaying(playing);
  }, []);

  return (
    <AudioContext.Provider
      value={{
        currentTrack,
        isPlaying,
        generatingAudio,
        playlist,
        play,
        pause,
        setGenerating,
        getCachedUrl,
        setCachedUrl,
        refreshCurrentTrackUrl,
        skipNext,
        skipPrevious,
        hasNext,
        hasPrevious,
        setPlaylist,
        setPlaying,
      }}
    >
      {children}
    </AudioContext.Provider>
  );
}

export function useAudio() {
  const ctx = useContext(AudioContext);
  if (!ctx) throw new Error("useAudio must be used within AudioProvider");
  return ctx;
}

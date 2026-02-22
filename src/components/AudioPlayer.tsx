import { Play, Pause, Volume2, RotateCcw, RotateCw, SkipBack, SkipForward, AlignLeft } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { getTranscriptForTrack } from "../data/transcripts";
import { LyricsPanel } from "./LyricsPanel";

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

interface AudioPlayerProps {
  src?: string;
  trackTitle?: string;
  externalPlaying?: boolean;
  onPlayingChange?: (playing: boolean) => void;
  onSkipNext?: () => void;
  onSkipPrevious?: () => void;
  hasNext?: boolean;
  hasPrevious?: boolean;
}

export function AudioPlayer({ src, trackTitle, externalPlaying, onPlayingChange, onSkipNext, onSkipPrevious, hasNext, hasPrevious }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [speedIndex, setSpeedIndex] = useState(2);
  const [lyricsOpen, setLyricsOpen] = useState(false);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;
  const transcript = src ? getTranscriptForTrack(trackTitle) : null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => { setPlaying(false); onPlayingChange?.(false); };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !src) return;
    audio.src = src;
    audio.load();
    audio.currentTime = 0;
    setCurrentTime(0);
    audio.play().then(() => { setPlaying(true); onPlayingChange?.(true); }).catch(() => {});
  }, [src]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || externalPlaying === undefined) return;
    if (externalPlaying && audio.paused && audio.src) {
      audio.play().catch(() => {});
      setPlaying(true);
    } else if (!externalPlaying && !audio.paused) {
      audio.pause();
      setPlaying(false);
    }
  }, [externalPlaying]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const next = !playing;
    if (next) audio.play(); else audio.pause();
    setPlaying(next);
    onPlayingChange?.(next);
  }, [playing, onPlayingChange]);

  const skip = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = Math.max(0, Math.min(audio.duration || 0, audio.currentTime + seconds));
  }, []);

  const cycleSpeed = useCallback(() => {
    setSpeedIndex((prev) => {
      const next = (prev + 1) % SPEED_OPTIONS.length;
      if (audioRef.current) audioRef.current.playbackRate = SPEED_OPTIONS[next];
      return next;
    });
  }, []);

  const seekBarRef = useRef<HTMLDivElement>(null);
  const [isSeeking, setIsSeeking] = useState(false);
  const [seekProgress, setSeekProgress] = useState<number | null>(null);

  const calcSeekPct = useCallback((clientX: number) => {
    const bar = seekBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handleSeekDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    e.preventDefault();
    const pct = calcSeekPct(e.clientX);
    setIsSeeking(true);
    setSeekProgress(pct * 100);

    const onMove = (ev: MouseEvent) => {
      const p = calcSeekPct(ev.clientX);
      setSeekProgress(p * 100);
    };
    const onUp = (ev: MouseEvent) => {
      const p = calcSeekPct(ev.clientX);
      if (audioRef.current) audioRef.current.currentTime = p * duration;
      setIsSeeking(false);
      setSeekProgress(null);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [duration, calcSeekPct]);

  const handleLyricsSeek = useCallback((time: number) => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.currentTime = time;
    if (!playing) {
      audio.play().catch(() => {});
      setPlaying(true);
      onPlayingChange?.(true);
    }
  }, [playing, onPlayingChange]);

  const volumeBarRef = useRef<HTMLDivElement>(null);

  const calcVolumePct = useCallback((clientX: number) => {
    const bar = volumeBarRef.current;
    if (!bar) return 0;
    const rect = bar.getBoundingClientRect();
    return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
  }, []);

  const handleVolumeDown = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    const pct = calcVolumePct(e.clientX);
    setVolume(pct);
    if (audioRef.current) audioRef.current.volume = pct;

    const onMove = (ev: MouseEvent) => {
      const p = calcVolumePct(ev.clientX);
      setVolume(p);
      if (audioRef.current) audioRef.current.volume = p;
    };
    const onUp = () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }, [calcVolumePct]);

  return (
    <motion.div
      initial={{ y: 60 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky bottom-16 sm:bottom-0 z-40 glass-panel-strong border-t border-border/50 px-3 sm:px-6 py-3 relative"
    >
      {/* Lyrics panel */}
      {transcript && (
        <LyricsPanel
          segments={transcript}
          currentTime={currentTime}
          open={lyricsOpen}
          onClose={() => setLyricsOpen(false)}
          onSeek={handleLyricsSeek}
        />
      )}

      <audio ref={audioRef} preload="metadata" />
      <div className="flex items-center gap-3 sm:gap-6">
        {/* Now playing info */}
        <div className="hidden sm:flex items-center gap-3 min-w-[160px] lg:min-w-[200px]">
          <div className="relative w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
            {playing && (
              <motion.div
                animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="absolute inset-0 rounded-lg bg-primary/20"
              />
            )}
            <div className={`w-3 h-3 rounded-full bg-primary ${playing ? "animate-pulse" : ""}`} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground truncate">{trackTitle || "Select a briefing"}</p>
            <p className="text-xs text-muted-foreground">{duration > 0 ? formatTime(duration) : "--:--"}</p>
          </div>
        </div>

        {/* Controls + timeline */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={onSkipPrevious} disabled={!hasPrevious} className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none" title="Previous briefing">
              <SkipBack className="w-4 h-4" />
            </button>
            <button onClick={() => skip(-10)} className="relative text-muted-foreground hover:text-foreground transition-colors" title="Back 10 seconds">
              <RotateCcw className="w-5 h-5" />
              <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold mt-[1px] pointer-events-none">10</span>
            </button>
            <button onClick={togglePlay} className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center hover:scale-105 transition-transform">
              {playing ? <Pause className="w-4 h-4 text-background" /> : <Play className="w-4 h-4 text-background ml-0.5" />}
            </button>
            <button onClick={() => skip(10)} className="relative text-muted-foreground hover:text-foreground transition-colors" title="Forward 10 seconds">
              <RotateCw className="w-5 h-5" />
              <span className="absolute inset-0 flex items-center justify-center text-[7px] font-bold mt-[1px] pointer-events-none">10</span>
            </button>
            <button onClick={onSkipNext} disabled={!hasNext} className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-30 disabled:pointer-events-none" title="Next briefing">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Timeline */}
          <div className="w-full max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{formatTime(isSeeking && seekProgress !== null ? (seekProgress / 100) * duration : currentTime)}</span>
              <div ref={seekBarRef} className="flex-1 relative group cursor-pointer" onMouseDown={handleSeekDown}>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full relative" style={{ width: `${isSeeking && seekProgress !== null ? seekProgress : progress}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums w-8">{duration > 0 ? formatTime(duration) : "--:--"}</span>
            </div>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-2 sm:gap-3 sm:min-w-[140px] justify-end">
          {/* Lyrics toggle */}
          {transcript && (
            <button
              onClick={() => setLyricsOpen(!lyricsOpen)}
              className={`w-8 h-8 rounded-md flex items-center justify-center transition-colors ${
                lyricsOpen ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground hover:bg-secondary"
              }`}
              title="Show transcript"
            >
              <AlignLeft className="w-4 h-4" />
            </button>
          )}
          <button onClick={cycleSpeed} className="text-xs font-medium text-muted-foreground w-10 text-center py-1 rounded-md bg-secondary hover:bg-secondary/80 transition-colors shrink-0">
            {SPEED_OPTIONS[speedIndex]}x
          </button>
          <div className="hidden sm:flex items-center gap-2">
            <Volume2 className="w-4 h-4 text-muted-foreground shrink-0" />
            <div ref={volumeBarRef} className="w-20 h-1 bg-secondary rounded-full overflow-hidden cursor-pointer" onMouseDown={handleVolumeDown}>
              <div className="h-full bg-muted-foreground rounded-full" style={{ width: `${volume * 100}%` }} />
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

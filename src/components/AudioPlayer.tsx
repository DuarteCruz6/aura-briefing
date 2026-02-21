import { Play, Pause, Volume2, RotateCcw, RotateCw } from "lucide-react";
import { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";

const SPEED_OPTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}


interface AudioPlayerProps {
  src?: string;
  trackTitle?: string;
}

export function AudioPlayer({ src, trackTitle }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.7);
  const [speedIndex, setSpeedIndex] = useState(2);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => setPlaying(false);
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
    audio.play().then(() => setPlaying(true)).catch(() => {});
  }, [src]);

  const togglePlay = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) audio.pause(); else audio.play();
    setPlaying(!playing);
  }, [playing]);

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

  const handleSeek = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    audio.currentTime = pct * duration;
  }, [duration]);

  const handleVolumeChange = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setVolume(pct);
    if (audioRef.current) audioRef.current.volume = pct;
  }, []);


  return (
    <motion.div
      initial={{ y: 60 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="sticky bottom-0 z-40 glass-panel-strong border-t border-border/50 px-6 py-3"
    >
      <audio ref={audioRef} preload="metadata" />
      <div className="flex items-center gap-6">
        {/* Now playing info */}
        <div className="flex items-center gap-3 min-w-[200px]">
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
          <div>
            <p className="text-sm font-medium text-foreground">{trackTitle || "Select a briefing"}</p>
            <p className="text-xs text-muted-foreground">{duration > 0 ? formatTime(duration) : "--:--"}</p>
          </div>
        </div>

        {/* Controls + timeline */}
        <div className="flex-1 flex flex-col items-center gap-1">
          <div className="flex items-center gap-4">
            <button onClick={() => skip(-10)} className="text-muted-foreground hover:text-foreground transition-colors" title="Back 10s">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              onClick={togglePlay}
              className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center hover:scale-105 transition-transform"
            >
              {playing ? <Pause className="w-4 h-4 text-background" /> : <Play className="w-4 h-4 text-background ml-0.5" />}
            </button>
            <button onClick={() => skip(10)} className="text-muted-foreground hover:text-foreground transition-colors" title="Forward 10s">
              <RotateCw className="w-4 h-4" />
            </button>
          </div>

          {/* Simple timeline */}
          <div className="w-full max-w-xl">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">{formatTime(currentTime)}</span>
              <div className="flex-1 relative group cursor-pointer" onClick={handleSeek}>
                <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary rounded-full relative transition-all duration-100"
                    style={{ width: `${progress}%` }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-foreground opacity-0 group-hover:opacity-100 transition-opacity shadow-lg" />
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-muted-foreground tabular-nums w-8">{duration > 0 ? formatTime(duration) : "--:--"}</span>
            </div>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3 min-w-[140px] justify-end">
          <button
            onClick={cycleSpeed}
            className="text-xs font-medium text-muted-foreground px-2 py-1 rounded-md bg-secondary hover:bg-secondary/80 transition-colors"
          >
            {SPEED_OPTIONS[speedIndex]}x
          </button>
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <div className="w-20 h-1 bg-secondary rounded-full overflow-hidden cursor-pointer" onClick={handleVolumeChange}>
            <div className="h-full bg-muted-foreground rounded-full" style={{ width: `${volume * 100}%` }} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

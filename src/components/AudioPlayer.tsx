import { Play, Pause, SkipForward, SkipBack, Volume2, Gauge } from "lucide-react";
import { useState } from "react";
import { motion } from "framer-motion";

export function AudioPlayer() {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(32);
  const [speed, setSpeed] = useState(1);

  const speeds = [0.75, 1, 1.25, 1.5, 2];
  const cycleSpeed = () => {
    const idx = speeds.indexOf(speed);
    setSpeed(speeds[(idx + 1) % speeds.length]);
  };

  const chapters = [
    { label: "Headlines", position: 15 },
    { label: "Markets", position: 40 },
    { label: "Tech", position: 65 },
    { label: "Weather", position: 85 },
  ];

  return (
    <motion.div
      initial={{ y: 60 }}
      animate={{ y: 0 }}
      transition={{ duration: 0.5, ease: "easeOut" }}
      className="fixed bottom-0 left-0 right-0 z-50 glass-panel-strong border-t border-border/50 px-6 py-3"
    >
      <div className="max-w-screen-2xl mx-auto flex items-center gap-6">
        {/* Now playing info */}
        <div className="flex items-center gap-3 min-w-[200px]">
          <div className="w-10 h-10 rounded-lg bg-primary/15 flex items-center justify-center">
            <div className="w-3 h-3 rounded-full bg-primary animate-pulse-glow" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">Daily Briefing</p>
            <p className="text-xs text-muted-foreground">Today · 7 min</p>
          </div>
        </div>

        {/* Controls + timeline */}
        <div className="flex-1 flex flex-col items-center gap-1.5">
          {/* Controls */}
          <div className="flex items-center gap-4">
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <SkipBack className="w-4 h-4" />
            </button>
            <button
              onClick={() => setPlaying(!playing)}
              className="w-9 h-9 rounded-full bg-foreground flex items-center justify-center hover:scale-105 transition-transform"
            >
              {playing ? (
                <Pause className="w-4 h-4 text-background" />
              ) : (
                <Play className="w-4 h-4 text-background ml-0.5" />
              )}
            </button>
            <button className="text-muted-foreground hover:text-foreground transition-colors">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>

          {/* Timeline */}
          <div className="w-full max-w-xl flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground tabular-nums w-8 text-right">2:14</span>
            <div className="flex-1 relative group">
              <div className="h-1 bg-secondary rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full relative transition-all duration-100"
                  style={{ width: `${progress}%` }}
                >
                  <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </div>
              {/* Chapter markers */}
              {chapters.map((ch) => (
                <div key={ch.label} className="absolute top-1/2 -translate-y-1/2" style={{ left: `${ch.position}%` }}>
                  <div className="w-1 h-3 bg-muted-foreground/40 rounded-full" />
                  <span className="absolute top-4 left-1/2 -translate-x-1/2 text-[9px] text-muted-foreground whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity">
                    {ch.label}
                  </span>
                </div>
              ))}
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums w-8">7:00</span>
          </div>
        </div>

        {/* Right controls */}
        <div className="flex items-center gap-3 min-w-[140px] justify-end">
          <button
            onClick={cycleSpeed}
            className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors px-2 py-1 rounded-md bg-secondary"
          >
            {speed}x
          </button>
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <div className="w-20 h-1 bg-secondary rounded-full overflow-hidden">
            <div className="h-full bg-muted-foreground rounded-full" style={{ width: "70%" }} />
          </div>
        </div>
      </div>
    </motion.div>
  );
}

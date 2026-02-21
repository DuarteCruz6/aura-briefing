import { X, Play, Pause, Maximize2, Volume2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";

interface VideoPlayerPopupProps {
  open: boolean;
  onClose: () => void;
  title: string;
}

export function VideoPlayerPopup({ open, onClose, title }: VideoPlayerPopupProps) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<number | null>(null);

  // Simulate video progress
  useEffect(() => {
    if (playing) {
      intervalRef.current = window.setInterval(() => {
        setProgress((p) => {
          if (p >= 100) {
            setPlaying(false);
            return 100;
          }
          return p + 0.5;
        });
      }, 100);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [playing]);

  useEffect(() => {
    if (!open) {
      setPlaying(false);
      setProgress(0);
    }
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl mx-4 rounded-2xl bg-card border border-border overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
              <div>
                <p className="text-xs text-primary font-semibold uppercase tracking-wider">AI Video Briefing</p>
                <h3 className="font-display font-semibold text-foreground text-sm">{title}</h3>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Video area */}
            <div className="relative aspect-video bg-background flex items-center justify-center">
              {/* Simulated video content */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/5" />
              
              {/* Animated visual elements to simulate video */}
              <div className="relative z-10 flex flex-col items-center gap-4">
                {!playing && progress === 0 ? (
                  <>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => setPlaying(true)}
                      className="w-20 h-20 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg play-button-glow"
                    >
                      <Play className="w-8 h-8 ml-1 fill-primary-foreground" />
                    </motion.button>
                    <p className="text-muted-foreground text-sm">Click to play AI-generated video</p>
                  </>
                ) : (
                  <>
                    {/* Animated bars to simulate video content */}
                    <div className="flex items-end gap-1.5 h-24">
                      {Array.from({ length: 20 }).map((_, i) => (
                        <motion.div
                          key={i}
                          animate={playing ? {
                            height: [20, Math.random() * 80 + 16, 20],
                          } : {}}
                          transition={{
                            duration: 0.8,
                            repeat: Infinity,
                            delay: i * 0.05,
                            ease: "easeInOut",
                          }}
                          className="w-2 rounded-full bg-primary/60"
                          style={{ height: 20 }}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground font-medium">
                      {playing ? "Generating visuals…" : "Video complete"}
                    </p>
                  </>
                )}
              </div>
            </div>

            {/* Controls */}
            <div className="px-5 py-3 border-t border-border/50">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setPlaying(!playing)}
                  className="w-8 h-8 rounded-full bg-primary/15 text-primary flex items-center justify-center hover:bg-primary/25 transition-colors"
                >
                  {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                </button>
                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden cursor-pointer"
                  onClick={(e) => {
                    const rect = e.currentTarget.getBoundingClientRect();
                    setProgress(((e.clientX - rect.left) / rect.width) * 100);
                  }}
                >
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground tabular-nums w-12 text-right">
                  {Math.floor(progress)}%
                </span>
                <Volume2 className="w-4 h-4 text-muted-foreground" />
                <Maximize2 className="w-4 h-4 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" />
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

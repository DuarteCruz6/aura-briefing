import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlignLeft, X } from "lucide-react";
import { TranscriptSegment } from "../data/transcripts";

interface LyricsPanelProps {
  segments: TranscriptSegment[];
  currentTime: number;
  open: boolean;
  onClose: () => void;
  onSeek?: (time: number) => void;
}

export function LyricsPanel({ segments, currentTime, open, onClose, onSeek }: LyricsPanelProps) {
  const activeRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeIndex = segments.findIndex(
    (s) => currentTime >= s.start && currentTime < s.end
  );

  useEffect(() => {
    if (activeRef.current && containerRef.current) {
      const container = containerRef.current;
      const el = activeRef.current;
      const containerHeight = container.clientHeight;
      const elTop = el.offsetTop;
      const elHeight = el.clientHeight;
      // Center the active line
      container.scrollTo({
        top: elTop - containerHeight / 2 + elHeight / 2,
        behavior: "smooth",
      });
    }
  }, [activeIndex]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 30, scale: 0.97 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="absolute bottom-full left-0 right-0 mb-2 mx-2 sm:mx-4 max-h-[55vh] sm:max-h-[45vh] rounded-2xl bg-background/95 backdrop-blur-xl border border-border/40 shadow-2xl overflow-hidden flex flex-col z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-border/20">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-full bg-primary/15 flex items-center justify-center">
                <AlignLeft className="w-3.5 h-3.5 text-primary" />
              </div>
              <span className="text-sm font-semibold text-foreground tracking-tight">Transcript</span>
            </div>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-secondary/80 transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Scrollable lyrics — Spotify-style centered focus */}
          <div
            ref={containerRef}
            className="flex-1 overflow-y-auto py-8 scroll-smooth"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {/* Top spacer for centering first items */}
            <div className="h-[20vh]" />

            {segments.map((seg, i) => {
              const isActive = i === activeIndex;
              const isPast = activeIndex > -1 && i < activeIndex;
              const distance = activeIndex > -1 ? Math.abs(i - activeIndex) : 0;
              // Fade out lines further from active
              const farOpacity = isActive ? 1 : isPast ? 0.25 : distance <= 1 ? 0.6 : distance <= 3 ? 0.35 : 0.2;

              return (
                <div
                  key={seg.id}
                  ref={isActive ? activeRef : undefined}
                  onClick={() => onSeek?.(seg.start)}
                  className="cursor-pointer px-5 sm:px-8 py-1.5 transition-all duration-500 select-none"
                  style={{ opacity: farOpacity }}
                >
                  <p
                    className={`leading-relaxed transition-all duration-500 ${
                      isActive
                        ? "text-foreground font-bold text-lg sm:text-xl"
                        : "text-muted-foreground font-medium text-base sm:text-lg hover:text-foreground"
                    }`}
                  >
                    {seg.text}
                  </p>
                </div>
              );
            })}

            {/* Bottom spacer */}
            <div className="h-[20vh]" />
          </div>

          {/* Gradient overlays for depth */}
          <div className="absolute top-[52px] left-0 right-0 h-12 bg-gradient-to-b from-background/95 to-transparent pointer-events-none z-10" />
          <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background/95 to-transparent pointer-events-none z-10" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

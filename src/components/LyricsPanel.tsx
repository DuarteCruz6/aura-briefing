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
      activeRef.current.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }
  }, [activeIndex]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3 }}
          className="absolute bottom-full left-0 right-0 mb-2 mx-2 sm:mx-6 max-h-[50vh] sm:max-h-[40vh] rounded-xl glass-panel-strong border border-border/50 overflow-hidden flex flex-col z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
              <AlignLeft className="w-4 h-4 text-primary" />
              Transcript
            </div>
            <button
              onClick={onClose}
              className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-secondary transition-colors"
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>

          {/* Scrollable lyrics */}
          <div
            ref={containerRef}
            className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin"
          >
            {segments.map((seg, i) => {
              const isActive = i === activeIndex;
              const isPast = activeIndex > -1 && i < activeIndex;

              return (
                <div
                  key={seg.id}
                  ref={isActive ? activeRef : undefined}
                  onClick={() => onSeek?.(seg.start)}
                  className={`cursor-pointer rounded-lg px-3 py-2 transition-all duration-300 ${
                    isActive
                      ? "bg-primary/10 text-foreground scale-[1.01]"
                      : isPast
                      ? "text-muted-foreground/50"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                  }`}
                >
                  <p
                    className={`text-sm leading-relaxed transition-all duration-300 ${
                      isActive ? "font-medium text-base" : ""
                    }`}
                  >
                    {seg.text}
                  </p>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

import { useRef } from "react";
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

export function LyricsPanel({ segments, open, onClose }: LyricsPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);

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

          {/* Scrollable text */}
          <div
            ref={containerRef}
            className="flex-1 overflow-y-auto px-5 sm:px-8 py-6 space-y-1"
            style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          >
            {segments.map((seg) => (
              <p
                key={seg.id}
                className="text-sm sm:text-base text-foreground/90 leading-relaxed"
              >
                {seg.text}
              </p>
            ))}
          </div>

          {/* Gradient overlays */}
          <div className="absolute top-[52px] left-0 right-0 h-8 bg-gradient-to-b from-background/95 to-transparent pointer-events-none z-10" />
          <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-background/95 to-transparent pointer-events-none z-10" />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

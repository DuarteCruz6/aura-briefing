import { Play, Pause, Clock, TrendingUp, Globe, Cpu, Bookmark, ChevronDown, Clapperboard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useBookmarks } from "../hooks/useBookmarks";

interface BriefingCardProps {
  title: string;
  description: string;
  duration: string;
  topics: string[];
  confidence: number;
  summary?: string;
  icon: React.ReactNode;
  index: number;
  audioUrl: string;
  isPremium: boolean;
  isCurrentlyPlaying?: boolean;
  onPlay?: (audioUrl: string, title: string) => void;
  onPause?: () => void;
  onPremiumClick?: () => void;
  onVideoClick?: (briefing: { title: string; summary?: string }) => void;
}

function getConfidenceColor(c: number) {
  if (c >= 90) return { ring: "border-green-500/40", glow: "shadow-[0_0_12px_-2px_hsl(150_80%_50%/0.3)]", dot: "bg-green-400" };
  if (c >= 70) return { ring: "border-yellow-500/40", glow: "shadow-[0_0_12px_-2px_hsl(45_100%_55%/0.3)]", dot: "bg-yellow-400" };
  return { ring: "border-red-500/40", glow: "shadow-[0_0_12px_-2px_hsl(0_80%_55%/0.3)]", dot: "bg-red-400" };
}

export function BriefingCard({ title, description, duration, topics, confidence, summary, icon, index, audioUrl, isPremium, isCurrentlyPlaying, onPlay, onPause, onPremiumClick, onVideoClick }: BriefingCardProps) {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const bookmarked = isBookmarked(title);
  const [expanded, setExpanded] = useState(false);
  const cc = getConfidenceColor(confidence);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`glass-panel cursor-pointer group relative overflow-hidden border-2 ${cc.ring} ${cc.glow} transition-all duration-300 hover:translate-y-[-2px] hover:shadow-xl`}
    >
      {/* Animated gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/3 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Confidence glow bar at top */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] opacity-60 ${
        confidence >= 90 ? "bg-gradient-to-r from-transparent via-green-400 to-transparent" :
        confidence >= 70 ? "bg-gradient-to-r from-transparent via-yellow-400 to-transparent" :
        "bg-gradient-to-r from-transparent via-red-400 to-transparent"
      }`} />

      <div className="relative p-4 sm:p-5" onClick={() => setExpanded(!expanded)}>
        {/* Header: icon + title */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            {icon}
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="font-display font-semibold text-foreground truncate text-sm sm:text-base">{title}</h3>
            <p className="text-xs sm:text-sm text-muted-foreground truncate">{description}</p>
          </div>
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-3 sm:gap-4 text-xs text-muted-foreground ml-[52px] mb-3">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {duration}
          </span>
          <span className="flex items-center gap-1.5">
            <span className={`w-2 h-2 rounded-full ${cc.dot}`} />
            {confidence}%
          </span>
          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
        </div>

        {/* Actions + Topics row */}
        <div className="flex items-end justify-between ml-[52px] gap-3">
          <div className="flex flex-wrap gap-1.5 min-w-0 flex-1">
            {topics.map((topic) => (
              <span
                key={topic}
                className="px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full bg-secondary text-secondary-foreground text-[11px] sm:text-xs font-medium"
              >
                {topic}
              </span>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <motion.button
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              onClick={(e) => {
                e.stopPropagation();
                if (isPremium) {
                  onVideoClick?.({ title, summary });
                } else {
                  onPremiumClick?.();
                }
              }}
              className="w-9 h-9 sm:w-11 sm:h-11 rounded-full flex items-center justify-center transition-all bg-secondary/50 text-muted-foreground hover:bg-primary/15 hover:text-primary"
              title={isPremium ? "Turn into video" : "Upgrade to Premium"}
            >
              <Clapperboard className="w-4 h-4 sm:w-5 sm:h-5" />
            </motion.button>
            <motion.button
              onClick={(e) => {
                e.stopPropagation();
                toggleBookmark({ title, description, duration, topics, confidence });
              }}
              whileTap={{ scale: 0.85 }}
              className={`w-8 h-8 sm:w-9 sm:h-9 rounded-full flex items-center justify-center transition-all ${
                bookmarked
                  ? "bg-primary/15 text-primary"
                  : "bg-secondary/50 text-muted-foreground hover:text-primary"
              }`}
            >
              <Bookmark className={`w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform duration-200 ${bookmarked ? "fill-primary scale-110" : ""}`} />
            </motion.button>
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (isCurrentlyPlaying) {
                  onPause?.();
                } else {
                  onPlay?.(audioUrl, title);
                }
              }}
              className="w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform duration-200"
            >
              {isCurrentlyPlaying ? (
                <Pause className="w-4 h-4 sm:w-5 sm:h-5 fill-primary-foreground" />
              ) : (
                <Play className="w-4 h-4 sm:w-5 sm:h-5 ml-0.5 fill-primary-foreground" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Expandable summary */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0 ml-[52px] border-t border-border/50">
              <p className="text-sm text-muted-foreground leading-relaxed pt-4">
                {summary || `A comprehensive ${duration} briefing covering ${topics.join(", ")}. Tap play to listen to the full audio summary powered by AI analysis of today's most relevant developments.`}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* VideoPlayerPopup is now rendered at page level */}
    </motion.div>
  );
}

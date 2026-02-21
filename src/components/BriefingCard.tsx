import { Play, Pause, Clock, TrendingUp, Globe, Cpu, MapPin, Bookmark, ChevronDown, Clapperboard } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { useBookmarks } from "../hooks/useBookmarks";
import { VideoPlayerPopup } from "./VideoPlayerPopup";

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
}

function getConfidenceColor(c: number) {
  if (c >= 90) return { ring: "border-green-500/40", glow: "shadow-[0_0_12px_-2px_hsl(150_80%_50%/0.3)]", dot: "bg-green-400" };
  if (c >= 70) return { ring: "border-yellow-500/40", glow: "shadow-[0_0_12px_-2px_hsl(45_100%_55%/0.3)]", dot: "bg-yellow-400" };
  return { ring: "border-red-500/40", glow: "shadow-[0_0_12px_-2px_hsl(0_80%_55%/0.3)]", dot: "bg-red-400" };
}

export function BriefingCard({ title, description, duration, topics, confidence, summary, icon, index, audioUrl, isPremium, isCurrentlyPlaying, onPlay, onPause, onPremiumClick }: BriefingCardProps) {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const bookmarked = isBookmarked(title);
  const [expanded, setExpanded] = useState(false);
  const [videoOpen, setVideoOpen] = useState(false);
  const cc = getConfidenceColor(confidence);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className={`glass-panel hover-lift cursor-pointer group relative overflow-hidden border-2 ${cc.ring} ${cc.glow}`}
    >
      {/* Animated gradient on hover */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/3 to-primary/0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

      {/* Confidence glow bar at top */}
      <div className={`absolute top-0 left-0 right-0 h-[2px] opacity-60 ${
        confidence >= 90 ? "bg-gradient-to-r from-transparent via-green-400 to-transparent" :
        confidence >= 70 ? "bg-gradient-to-r from-transparent via-yellow-400 to-transparent" :
        "bg-gradient-to-r from-transparent via-red-400 to-transparent"
      }`} />

      <div className="relative flex items-center gap-4 p-5" onClick={() => setExpanded(!expanded)}>
        {/* Left: icon + info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
              {icon}
            </div>
            <div className="min-w-0">
              <h3 className="font-display font-semibold text-foreground truncate">{title}</h3>
              <p className="text-sm text-muted-foreground truncate">{description}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs text-muted-foreground ml-[52px]">
            <span className="flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {duration}
            </span>
            <span className="flex items-center gap-1.5">
              <span className={`w-2 h-2 rounded-full ${cc.dot}`} />
              {confidence}% confidence
            </span>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-300 ${expanded ? "rotate-180" : ""}`} />
          </div>

          <div className="flex flex-wrap gap-1.5 mt-3 ml-[52px]">
            {topics.map((topic) => (
              <span
                key={topic}
                className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium"
              >
                {topic}
              </span>
            ))}
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-2 shrink-0">
          <motion.button
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            onClick={(e) => {
              e.stopPropagation();
              if (isPremium) {
                setVideoOpen(true);
              } else {
                onPremiumClick?.();
              }
            }}
            className="w-11 h-11 rounded-full flex items-center justify-center transition-all bg-secondary/50 text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-primary/15 hover:text-primary"
            title={isPremium ? "Turn into video" : "Upgrade to Premium"}
          >
            <Clapperboard className="w-5 h-5" />
          </motion.button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleBookmark({ title, description, duration, topics, confidence });
            }}
            className={`w-9 h-9 rounded-full flex items-center justify-center transition-all ${
              bookmarked
                ? "bg-primary/15 text-primary"
                : "bg-secondary/50 text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-primary"
            }`}
          >
            <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-primary" : ""}`} />
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              if (isCurrentlyPlaying) {
                onPause?.();
              } else {
                onPlay?.(audioUrl, title);
              }
            }}
            className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:scale-105 transition-transform duration-200"
          >
            {isCurrentlyPlaying ? (
              <Pause className="w-5 h-5 fill-primary-foreground" />
            ) : (
              <Play className="w-5 h-5 ml-0.5 fill-primary-foreground" />
            )}
          </button>
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
            <div className="px-5 pb-5 pt-0 ml-[52px] border-t border-border/50">
              <p className="text-sm text-muted-foreground leading-relaxed pt-4">
                {summary || `A comprehensive ${duration} briefing covering ${topics.join(", ")}. Tap play to listen to the full audio summary powered by AI analysis of today's most relevant developments.`}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <VideoPlayerPopup open={videoOpen} onClose={() => setVideoOpen(false)} title={title} />
    </motion.div>
  );
}

export const briefings = [
  {
    title: "Daily Briefing",
    description: "Your personalized morning update",
    duration: "7 min",
    topics: ["Markets", "AI", "Climate", "Politics"],
    confidence: 94,
    summary: "Markets opened higher as tech stocks rallied on strong earnings. AI regulation talks continue in Brussels with new proposals expected this week. Climate summit delegates reached a preliminary agreement on carbon credits. Key political developments include upcoming policy votes on infrastructure spending.",
    icon: <TrendingUp className="w-5 h-5" />,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
  },
  {
    title: "Tech Briefing",
    description: "Latest in technology & startups",
    duration: "5 min",
    topics: ["AI Models", "Funding", "Product Launches"],
    confidence: 97,
    summary: "New frontier AI models announced with improved reasoning capabilities. Several startups secured Series B funding rounds totaling $2.3B. Major product launches this week include updates to developer tools and a new consumer AI assistant.",
    icon: <Cpu className="w-5 h-5" />,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
  },
  {
    title: "World Briefing",
    description: "Global affairs & geopolitics",
    duration: "8 min",
    topics: ["Diplomacy", "Conflicts", "Trade", "Elections"],
    confidence: 91,
    summary: "Diplomatic talks between key nations show progress on trade agreements. Ongoing conflicts see shifts in humanitarian corridors. New trade tariffs proposed by multiple blocs. Upcoming elections in three countries could reshape regional alliances.",
    icon: <Globe className="w-5 h-5" />,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3",
  },
  {
    title: "Ireland Briefing",
    description: "Local news & developments",
    duration: "4 min",
    topics: ["Economy", "Housing", "Tech Hub", "Sports"],
    confidence: 89,
    summary: "Irish economy shows resilient growth figures despite global headwinds. New housing development plans announced for Dublin and Cork. Tech hub expansion continues with major employers adding roles. Weekend sports roundup covers GAA and rugby highlights.",
    icon: <MapPin className="w-5 h-5" />,
    audioUrl: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
  },
];

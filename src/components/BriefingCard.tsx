import { Play, Clock, TrendingUp, Globe, Cpu, MapPin, Bookmark } from "lucide-react";
import { motion } from "framer-motion";
import { useBookmarks } from "@/hooks/useBookmarks";

interface BriefingCardProps {
  title: string;
  description: string;
  duration: string;
  topics: string[];
  confidence: number;
  icon: React.ReactNode;
  index: number;
}

export function BriefingCard({ title, description, duration, topics, confidence, icon, index }: BriefingCardProps) {
  const { isBookmarked, toggleBookmark } = useBookmarks();
  const bookmarked = isBookmarked(title);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
      className="glass-panel hover-lift p-5 cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary">
            {icon}
          </div>
          <div>
            <h3 className="font-display font-semibold text-foreground">{title}</h3>
            <p className="text-sm text-muted-foreground">{description}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
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
          <button className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-primary opacity-0 group-hover:opacity-100 transition-opacity duration-200">
            <Play className="w-4 h-4 ml-0.5" />
          </button>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Clock className="w-3.5 h-3.5" />
          {duration}
        </span>
        <span className="flex items-center gap-1">
          <TrendingUp className="w-3.5 h-3.5" />
          {confidence}% confidence
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5 mt-3">
        {topics.map((topic) => (
          <span
            key={topic}
            className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium"
          >
            {topic}
          </span>
        ))}
      </div>
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
    icon: <TrendingUp className="w-5 h-5" />,
  },
  {
    title: "Tech Briefing",
    description: "Latest in technology & startups",
    duration: "5 min",
    topics: ["AI Models", "Funding", "Product Launches"],
    confidence: 97,
    icon: <Cpu className="w-5 h-5" />,
  },
  {
    title: "World Briefing",
    description: "Global affairs & geopolitics",
    duration: "8 min",
    topics: ["Diplomacy", "Conflicts", "Trade", "Elections"],
    confidence: 91,
    icon: <Globe className="w-5 h-5" />,
  },
  {
    title: "Ireland Briefing",
    description: "Local news & developments",
    duration: "4 min",
    topics: ["Economy", "Housing", "Tech Hub", "Sports"],
    confidence: 89,
    icon: <MapPin className="w-5 h-5" />,
  },
];

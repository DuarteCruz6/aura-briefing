import { Play, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export function TodaysBriefing() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-panel glow-border p-8 mb-8"
    >
      <div className="flex items-center gap-2 mb-1">
        <Sparkles className="w-4 h-4 text-primary" />
        <span className="text-xs font-medium text-primary uppercase tracking-wider">AI-Curated</span>
      </div>
      <h1 className="font-display text-3xl font-bold text-foreground mb-2">Today's Briefing</h1>
      <p className="text-muted-foreground mb-6 max-w-lg">
        Your personalized intelligence digest — 14 stories across 4 topics, synthesized from 230+ sources.
      </p>

      <div className="flex items-center gap-4">
        <button className="flex items-center gap-2.5 bg-primary text-primary-foreground px-6 py-3 rounded-full font-semibold text-sm hover:scale-105 transition-transform play-button-glow">
          <Play className="w-5 h-5 ml-0.5" />
          Play Full Briefing
        </button>
        <span className="text-sm text-muted-foreground">7 min · Updated 12 min ago</span>
      </div>
    </motion.section>
  );
}

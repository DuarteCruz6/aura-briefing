import { Crown, Video, Monitor, Smartphone } from "lucide-react";
import { motion } from "framer-motion";

export function PremiumBanner() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.5 }}
      className="glass-panel p-6 mt-8 relative overflow-hidden"
    >
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-neon-purple/5 pointer-events-none" />

      <div className="relative flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-primary uppercase tracking-wider">Premium</span>
          </div>
          <h3 className="font-display text-lg font-semibold text-foreground mb-1">Video Briefing Available</h3>
          <p className="text-sm text-muted-foreground mb-4 max-w-md">
            Transform your audio briefing into a cinematic video with AI-generated visuals, charts, and motion graphics.
          </p>
          <button className="flex items-center gap-2 bg-primary/10 text-primary px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/20 transition-colors">
            <Video className="w-4 h-4" />
            Generate Video
          </button>
        </div>

        <div className="flex items-center gap-3">
          <div className="w-20 h-36 rounded-lg bg-secondary/80 border border-border/50 flex items-center justify-center">
            <Smartphone className="w-5 h-5 text-muted-foreground" />
          </div>
          <div className="w-36 h-24 rounded-lg bg-secondary/80 border border-border/50 flex items-center justify-center">
            <Monitor className="w-5 h-5 text-muted-foreground" />
          </div>
        </div>
      </div>
    </motion.section>
  );
}

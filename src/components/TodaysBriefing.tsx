import { Play, Sparkles } from "lucide-react";
import { motion } from "framer-motion";

export function TodaysBriefing() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-panel glow-border p-8 mb-8 relative overflow-hidden"
    >
      {/* Radar sweep background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] opacity-[0.08]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full"
          style={{
            background: "conic-gradient(from 0deg, transparent 0%, hsl(210 100% 56%) 10%, transparent 30%)",
          }}
        />
        {/* Radar rings */}
        <div className="absolute inset-[20%] rounded-full border border-primary/10" />
        <div className="absolute inset-[40%] rounded-full border border-primary/10" />
        <div className="absolute inset-0 rounded-full border border-primary/10" />
        {/* Radar dots - stories found */}
        {[
          { top: "25%", left: "60%" },
          { top: "45%", left: "80%" },
          { top: "70%", left: "35%" },
          { top: "30%", left: "20%" },
          { top: "60%", left: "65%" },
        ].map((pos, i) => (
          <motion.div
            key={i}
            animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.6 }}
            className="absolute w-1.5 h-1.5 rounded-full bg-primary"
            style={pos}
          />
        ))}
      </div>

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-1">
          <Sparkles className="w-4 h-4 text-primary" />
          <span className="text-xs font-medium text-primary uppercase tracking-wider">AI-Curated</span>
        </div>
        <h1 className="font-display text-3xl font-bold text-foreground mb-2">Today's Briefing</h1>
        <p className="text-muted-foreground mb-6 max-w-lg">
          Your personalized intelligence digest — 14 stories across 4 topics, synthesized from 230+ sources.
        </p>

        <div className="flex items-center gap-4">
          {/* Pulsing Audio Orb */}
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            className="relative w-14 h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center play-button-glow"
          >
            {/* Pulse rings */}
            <motion.div
              animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              className="absolute inset-0 rounded-full bg-primary/30"
            />
            <motion.div
              animate={{ scale: [1, 1.9], opacity: [0.2, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeOut", delay: 0.5 }}
              className="absolute inset-0 rounded-full bg-primary/20"
            />
            <Play className="w-6 h-6 ml-0.5 fill-primary-foreground relative z-10" />
          </motion.button>
          <div>
            <span className="text-sm font-medium text-foreground">Play Full Briefing</span>
            <p className="text-xs text-muted-foreground">7 min · Updated 12 min ago</p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}

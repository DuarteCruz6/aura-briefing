import { Play, Pause, Sparkles } from "lucide-react";
import { motion } from "framer-motion";
import { RotatingGlobe } from "./RotatingGlobe";
import { useState } from "react";

interface TodaysBriefingProps {
  frequency?: string;
  onPlay?: (id: string, audioUrl: string, title: string) => void;
  isPlaying?: boolean;
  currentTrackId?: string;
  onPause?: () => void;
}

const BRIEFING_AUDIO = "/audio/podcast.wav";

export function TodaysBriefing({ frequency = "daily", onPlay, isPlaying, currentTrackId, onPause }: TodaysBriefingProps) {
  const freqLabel = frequency === "weekly" ? "This Week's" : frequency === "monthly" ? "This Month's" : "Today's";
  const freqDesc = frequency === "weekly"
    ? "Your weekly intelligence digest — top stories from the past 7 days."
    : frequency === "monthly"
    ? "Your monthly intelligence recap — key developments from the past 30 days."
    : "Your personalized intelligence digest — 14 stories across 4 topics, synthesized from 230+ sources.";

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="glass-panel glow-border p-5 sm:p-8 mb-8 relative overflow-hidden"
    >
      {/* Radar sweep background */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[200px] sm:w-[300px] h-[200px] sm:h-[300px] opacity-[0.08]">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full"
          style={{
            background: "conic-gradient(from 0deg, transparent 0%, hsl(var(--primary)) 10%, transparent 30%)",
          }}
        />
        <div className="absolute inset-[20%] rounded-full border border-primary/10" />
        <div className="absolute inset-[40%] rounded-full border border-primary/10" />
        <div className="absolute inset-0 rounded-full border border-primary/10" />
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

      <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        {/* Left content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-primary uppercase tracking-wider">AI-Curated</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-bold text-foreground mb-2">{freqLabel} Briefing</h1>
          <p className="text-sm sm:text-base text-muted-foreground mb-6 max-w-lg">
            {freqDesc}
          </p>

          <div className="flex items-center gap-4">
            {(() => {
              const briefingId = "todays-briefing";
              const briefingTitle = `${freqLabel} Briefing`;
              const isCurrent = isPlaying && currentTrackId === briefingId;
              return (
                <>
                  <motion.button
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => isCurrent ? onPause?.() : onPlay?.(briefingId, BRIEFING_AUDIO, briefingTitle)}
                    className="relative w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-primary text-primary-foreground flex items-center justify-center play-button-glow flex-shrink-0"
                  >
                    {isCurrent
                      ? <Pause className="w-5 h-5 sm:w-6 sm:h-6 fill-primary-foreground relative z-10" />
                      : <Play className="w-5 h-5 sm:w-6 sm:h-6 ml-0.5 fill-primary-foreground relative z-10" />
                    }
                  </motion.button>
                  <div>
                    <span className="text-sm font-medium text-foreground">{isCurrent ? "Pause Briefing" : "Play Full Briefing"}</span>
                    <p className="text-xs text-muted-foreground">7 min · Updated 12 min ago</p>
                  </div>
                </>
              );
            })()}
          </div>
        </div>

        {/* Globe */}
        <div className="hidden md:block flex-shrink-0">
          <RotatingGlobe />
        </div>
      </div>
    </motion.section>
  );
}

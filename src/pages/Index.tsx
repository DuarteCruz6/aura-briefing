import { useState, useCallback, useEffect } from "react";
import { MessageSquare, Crown } from "lucide-react";
import { AppSidebar } from "../components/AppSidebar";
import { useAuth } from "../hooks/useAuth";
import { TodaysBriefing } from "../components/TodaysBriefing";
import { BriefingCard, briefings } from "../components/BriefingCard";
import { AudioPlayer } from "../components/AudioPlayer";
import { ChatSidebar } from "../components/ChatSidebar";
import { PremiumBanner } from "../components/PremiumBanner";
import { BackgroundEffects } from "../components/BackgroundEffects";

const Index = () => {
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<{ src: string; title: string } | null>(null);
  const [isPremium, setIsPremium] = useState(() => localStorage.getItem("briefcast_trial") === "active");
  const [frequency, setFrequency] = useState(() => localStorage.getItem("briefcast_frequency") || "daily");

  // Re-check premium + frequency when popup closes or page focuses
  useEffect(() => {
    if (!premiumOpen) {
      setIsPremium(localStorage.getItem("briefcast_trial") === "active");
    }
  }, [premiumOpen]);

  useEffect(() => {
    const checkFrequency = () => setFrequency(localStorage.getItem("briefcast_frequency") || "daily");
    window.addEventListener("focus", checkFrequency);
    // Also poll for changes from settings page
    const interval = setInterval(checkFrequency, 1000);
    return () => {
      window.removeEventListener("focus", checkFrequency);
      clearInterval(interval);
    };
  }, []);

  const handlePlay = useCallback((audioUrl: string, title: string) => {
    setCurrentTrack({ src: audioUrl, title });
  }, []);

  // Filter briefings based on frequency
  const filteredBriefings = frequency === "daily"
    ? briefings
    : frequency === "weekly"
    ? briefings.filter((_, i) => i < 3) // Show fewer for weekly
    : briefings.filter((_, i) => i < 2); // Show even fewer for monthly (top summaries)

  const freqLabel = frequency === "weekly" ? "Weekly" : frequency === "monthly" ? "Monthly" : "Daily";

  if (!user) return null;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      <BackgroundEffects />
      <AppSidebar />

      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        <div className="flex-1 overflow-y-auto scrollbar-thin pb-4">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">Wednesday, Feb 21</p>
                <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">Good morning</h2>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPremiumOpen(true)}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-lg bg-primary/10 text-primary text-xs sm:text-sm font-medium hover:bg-primary/20 transition-colors"
                >
                  <Crown className="w-4 h-4" />
                  <span className="hidden sm:inline">Premium</span>
                </button>
                <button
                  onClick={() => setChatOpen(!chatOpen)}
                  className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-2 rounded-lg bg-secondary text-secondary-foreground text-xs sm:text-sm font-medium hover:bg-secondary/80 transition-colors"
                >
                  <MessageSquare className="w-4 h-4" />
                  <span className="hidden sm:inline">Ask AI</span>
                </button>
              </div>
            </div>

            <TodaysBriefing frequency={frequency} />

            <div className="space-y-3">
              <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Your {freqLabel} Briefings
              </h3>
              {filteredBriefings.map((b, i) => (
                <BriefingCard
                  key={b.title}
                  {...b}
                  index={i}
                  isPremium={isPremium}
                  onPlay={handlePlay}
                />
              ))}
            </div>

            <PremiumBanner showPopup={premiumOpen} onPopupChange={setPremiumOpen} />
          </div>
        </div>
        <AudioPlayer
          src={currentTrack?.src}
          trackTitle={currentTrack?.title}
        />
      </main>

      <ChatSidebar open={chatOpen} onClose={() => setChatOpen(false)} />
    </div>
  );
};

export default Index;

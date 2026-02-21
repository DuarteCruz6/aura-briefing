import { useState, useCallback, useEffect } from "react";
import { MessageSquare, Crown, Globe, Cpu, TrendingUp, MapPin } from "lucide-react";
import { AppSidebar } from "../components/AppSidebar";
import { useAuth } from "../hooks/useAuth";
import { TodaysBriefing } from "../components/TodaysBriefing";
import { BriefingCard, briefings as staticBriefings } from "../components/BriefingCard";
import { AudioPlayer } from "../components/AudioPlayer";
import { ChatSidebar } from "../components/ChatSidebar";
import { PremiumBanner } from "../components/PremiumBanner";
import { BackgroundEffects } from "../components/BackgroundEffects";
import { VideoPlayerPopup } from "../components/VideoPlayerPopup";
import { api, type BriefingEntry } from "../lib/api";

const Index = () => {
  const { user } = useAuth();
  const [chatOpen, setChatOpen] = useState(false);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<{ src: string; title: string } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [videoBriefing, setVideoBriefing] = useState<{ title: string; summary: string } | null>(null);
  const [isPremium, setIsPremium] = useState(() => {
    const trial = localStorage.getItem("briefcast_trial");
    if (trial !== "active") return false;
    const start = localStorage.getItem("briefcast_trial_start");
    if (!start) { localStorage.removeItem("briefcast_trial"); return false; }
    if (Date.now() - new Date(start).getTime() > 7 * 24 * 60 * 60 * 1000) {
      localStorage.removeItem("briefcast_trial");
      localStorage.removeItem("briefcast_trial_start");
      return false;
    }
    return true;
  });
  const [frequency, setFrequency] = useState(() => localStorage.getItem("briefcast_frequency") || "daily");
  const [apiBriefings, setApiBriefings] = useState<BriefingEntry[]>([]);
  const [briefingsLoading, setBriefingsLoading] = useState(true);

  // Load briefings from API (latest from user's sources)
  useEffect(() => {
    api
      .getBriefings()
      .then((r) => setApiBriefings(r.briefings || []))
      .catch(() => setApiBriefings([]))
      .finally(() => setBriefingsLoading(false));
  }, []);

  // Re-check premium + frequency when popup closes or page focuses
  useEffect(() => {
    if (!premiumOpen) {
      setIsPremium(localStorage.getItem("briefcast_trial") === "active");
    }
  }, [premiumOpen]);

  useEffect(() => {
    const checkFrequency = () => setFrequency(localStorage.getItem("briefcast_frequency") || "daily");
    window.addEventListener("focus", checkFrequency);
    const interval = setInterval(checkFrequency, 1000);
    return () => {
      window.removeEventListener("focus", checkFrequency);
      clearInterval(interval);
    };
  }, []);

  // Map API briefings to card shape, or use static list when no sources
  const sourceIconMap: Record<string, React.ReactNode> = {
    youtube: <TrendingUp className="w-5 h-5" />,
    x: <Cpu className="w-5 h-5" />,
    linkedin: <Globe className="w-5 h-5" />,
    news: <Globe className="w-5 h-5" />,
    podcast: <Cpu className="w-5 h-5" />,
  };
  const staticFiltered =
    frequency === "daily"
      ? staticBriefings
      : frequency === "weekly"
      ? staticBriefings.filter((_, i) => i < 3)
      : staticBriefings.filter((_, i) => i < 2);
  const briefingCards =
    apiBriefings.length > 0
      ? apiBriefings.map((b) => ({
          title: b.title,
          description: b.error ? "Could not fetch latest." : "Latest from your source",
          duration: "—",
          topics: [b.source_type],
          confidence: b.error ? 50 : 85,
          summary: b.error ? b.error : "Latest update from your followed source.",
          icon: sourceIconMap[b.source_type] ?? <Globe className="w-5 h-5" />,
          audioUrl: "",
        }))
      : staticFiltered;
  const filteredBriefings = briefingCards;

  const freqLabel = frequency === "weekly" ? "Weekly" : frequency === "monthly" ? "Monthly" : "Daily";

  const handlePlay = useCallback((audioUrl: string, title: string) => {
    setCurrentTrack({ src: audioUrl, title });
    setIsPlaying(true);
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const currentIndex = currentTrack ? filteredBriefings.findIndex(b => b.title === currentTrack.title) : -1;

  const handleSkipNext = useCallback(() => {
    const idx = currentTrack ? filteredBriefings.findIndex(b => b.title === currentTrack.title) : -1;
    if (idx >= 0 && idx < filteredBriefings.length - 1) {
      const next = filteredBriefings[idx + 1];
      setCurrentTrack({ src: next.audioUrl, title: next.title });
      setIsPlaying(true);
    }
  }, [currentTrack, filteredBriefings]);

  const handleSkipPrevious = useCallback(() => {
    const idx = currentTrack ? filteredBriefings.findIndex(b => b.title === currentTrack.title) : -1;
    if (idx > 0) {
      const prev = filteredBriefings[idx - 1];
      setCurrentTrack({ src: prev.audioUrl, title: prev.title });
      setIsPlaying(true);
    }
  }, [currentTrack, filteredBriefings]);

  if (!user) return null;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      <BackgroundEffects />
      <AppSidebar />

      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        <div className="flex-1 overflow-y-auto scrollbar-thin pb-20 sm:pb-4">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            {/* Top bar */}
            <div className="flex items-center justify-between mb-6 sm:mb-8">
              <div>
                <p className="text-xs sm:text-sm text-muted-foreground">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}</p>
                <h2 className="font-display text-lg sm:text-xl font-semibold text-foreground">
                  {(() => {
                    const h = new Date().getHours();
                    return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
                  })()}{user?.name ? `, ${user.name.split(" ")[0]}` : ""}
                </h2>
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

            <TodaysBriefing frequency={frequency} onPlay={handlePlay} isPlaying={isPlaying} currentTrackTitle={currentTrack?.title} onPause={handlePause} />

            <div className="space-y-3">
              <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                Your {freqLabel} Briefings
              </h3>
              {briefingsLoading ? (
                <p className="text-sm text-muted-foreground py-4">Loading briefings…</p>
              ) : (
                filteredBriefings.map((b, i) => (
                  <BriefingCard
                    key={b.title}
                    {...b}
                    index={i}
                    isPremium={isPremium}
                    isCurrentlyPlaying={isPlaying && currentTrack?.title === b.title}
                    onPlay={handlePlay}
                    onPause={handlePause}
                    onPremiumClick={() => setPremiumOpen(true)}
                    onVideoClick={(br) => setVideoBriefing(br ? { title: br.title, summary: br.summary ?? "" } : null)}
                  />
                ))
              )}
            </div>

            <PremiumBanner showPopup={premiumOpen} onPopupChange={setPremiumOpen} onTrialActivated={() => setIsPremium(true)} />
          </div>
        </div>
        <AudioPlayer
          src={currentTrack?.src}
          trackTitle={currentTrack?.title}
          externalPlaying={isPlaying}
          onPlayingChange={setIsPlaying}
          onSkipNext={handleSkipNext}
          onSkipPrevious={handleSkipPrevious}
          hasNext={currentIndex >= 0 && currentIndex < filteredBriefings.length - 1}
          hasPrevious={currentIndex > 0}
        />
      </main>

      <ChatSidebar open={chatOpen} onClose={() => setChatOpen(false)} />
      <VideoPlayerPopup
        open={!!videoBriefing}
        onClose={() => setVideoBriefing(null)}
        title={videoBriefing?.title ?? ""}
        summary={videoBriefing?.summary ?? ""}
        isPremium={isPremium}
      />
    </div>
  );
};

export default Index;

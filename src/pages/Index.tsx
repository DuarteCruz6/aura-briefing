import { useState, useCallback, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { MessageSquare, Crown, Globe, Cpu, TrendingUp, MapPin, Compass, Sparkles, Headphones, Radio, Mic } from "lucide-react";
import { AppSidebar } from "../components/AppSidebar";
import { useAuth } from "../hooks/useAuth";
import { useFavourites } from "../hooks/useFavourites";
import { usePreferencesTopics } from "../hooks/usePreferencesTopics";
import { useSources } from "../hooks/useSources";
import { BriefingCard } from "../components/BriefingCard";
import { AudioPlayer } from "../components/AudioPlayer";
import { ChatSidebar } from "../components/ChatSidebar";
import { useChat } from "../contexts/ChatContext";
import { PremiumBanner } from "../components/PremiumBanner";
import { BackgroundEffects } from "../components/BackgroundEffects";
import { VideoPlayerPopup } from "../components/VideoPlayerPopup";
import { api, type BriefingEntry } from "../lib/api";

const Index = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { favourites } = useFavourites();
  const { topics: apiTopics } = usePreferencesTopics();
  const { sources } = useSources();
  const favouriteLabels = [
    ...apiTopics.map((t) => t.topic),
    ...sources.map((s) => s.name || s.url),
    ...favourites.map((f) => f.label),
  ];
  const hasFavourites = favouriteLabels.length > 0;
  const { chatOpen, setChatOpen } = useChat();
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [currentTrack, setCurrentTrack] = useState<{ id: string; src: string; title: string } | null>(null);
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

  // Generate themed briefing cards from favourites
  const favouriteIconMap: Record<string, React.ReactNode> = {
    topic: <TrendingUp className="w-5 h-5" />,
    region: <MapPin className="w-5 h-5" />,
    interest: <Sparkles className="w-5 h-5" />,
    source: <Globe className="w-5 h-5" />,
  };
  const themeIcons = [<Headphones className="w-5 h-5" />, <Radio className="w-5 h-5" />, <Mic className="w-5 h-5" />, <Cpu className="w-5 h-5" />];
  const freqLabel = frequency === "weekly" ? "Weekly" : frequency === "monthly" ? "Monthly" : "Daily";

  const favouriteBriefings = hasFavourites ? [{
    id: "combined-briefing",
    title: `Your ${freqLabel} Briefing`,
    description: `Covering ${favouriteLabels.join(", ")}`,
    duration: `${5 + favouriteLabels.length * 2} min`,
    topics: favouriteLabels.slice(0, 4),
    confidence: 85,
    summary: `Your personalized podcast briefing covering the latest developments in ${favouriteLabels.join(", ")}.`,
    icon: <Headphones className="w-5 h-5" />,
    audioUrl: "",
    generateText: `Give me a comprehensive briefing covering the latest news and developments in: ${favouriteLabels.join(", ")}. Keep it informative and engaging, like a podcast host.`,
    generateUrls: undefined as string[] | undefined,
  }] : [];

  // Merge API briefings with favourite-generated briefings
  const sourceIconMap: Record<string, React.ReactNode> = {
    youtube: <TrendingUp className="w-5 h-5" />,
    x: <Cpu className="w-5 h-5" />,
    linkedin: <Globe className="w-5 h-5" />,
    news: <Globe className="w-5 h-5" />,
    podcast: <Cpu className="w-5 h-5" />,
  };
  const apiBriefingCards = apiBriefings.map((b) => ({
    id: String(b.id),
    title: b.title,
    description: b.error ? "Could not fetch latest." : "Latest from your source",
    duration: "—",
    topics: [b.source_type],
    confidence: b.error ? 50 : 85,
    summary: b.error ? b.error : "Latest update from your followed source.",
    icon: sourceIconMap[b.source_type] ?? <Globe className="w-5 h-5" />,
    audioUrl: "",
    generateText: undefined as string | undefined,
    generateUrls: b.error ? undefined : [b.source_url],
  }));

  const filteredBriefings = [...favouriteBriefings, ...apiBriefingCards];

  // Cache generated audio blob URLs so we don't regenerate
  const audioCache = useRef<Record<string, string>>({});
  const [generatingAudio, setGeneratingAudio] = useState<string | null>(null);
  const briefingsRef = useRef(filteredBriefings);
  const generatingIdRef = useRef<string | null>(null);
  briefingsRef.current = filteredBriefings;

  const handlePlay = useCallback(async (id: string, audioUrl: string, title: string) => {
    // If there's already a cached or provided audio URL, play it directly
    if (audioUrl) {
      setCurrentTrack({ id, src: audioUrl, title });
      setIsPlaying(true);
      return;
    }

    // Avoid starting a second generation (e.g. double-click or re-render)
    if (generatingIdRef.current) return;
    generatingIdRef.current = id;
    setGeneratingAudio(id);

    const briefing = briefingsRef.current.find((b) => b.id === id);
    if (!briefing) {
      generatingIdRef.current = null;
      setGeneratingAudio(null);
      return;
    }

    // Check cache first
    if (audioCache.current[id]) {
      setCurrentTrack({ id, src: audioCache.current[id], title });
      setIsPlaying(true);
      generatingIdRef.current = null;
      setGeneratingAudio(null);
      return;
    }
    toast.info("Generating your podcast audio…", { id: `gen-${id}` });

    const timeoutMs = 90_000;
    const timeoutId = setTimeout(() => {
      if (generatingIdRef.current === id) generatingIdRef.current = null;
      setGeneratingAudio((prev) => (prev === id ? null : prev));
      toast.error("Generation took too long. Try again.", { id: `gen-${id}` });
    }, timeoutMs);

    try {
      let blob: Blob;
      // "Your Daily Briefing" card: generate from user's sources/topics (LLM summary then TTS), not the prompt
      if (id === "combined-briefing") {
        blob = await api.generatePersonalBriefingAudio();
      } else if (briefing.generateUrls?.length) {
        blob = await api.generatePodcastFromUrls(briefing.generateUrls);
      } else if (briefing.generateText) {
        blob = await api.generatePodcast(briefing.generateText);
      } else {
        toast.error("No content available to generate audio", { id: `gen-${id}` });
        generatingIdRef.current = null;
        setGeneratingAudio(null);
        clearTimeout(timeoutId);
        return;
      }
      const blobUrl = URL.createObjectURL(blob);
      audioCache.current[id] = blobUrl;
      setCurrentTrack({ id, src: blobUrl, title });
      setIsPlaying(true);
      toast.success("Podcast ready!", { id: `gen-${id}` });
    } catch (err: any) {
      // Fallback to static sample audio when backend is unreachable
      const fallback = "/audio/podcast.wav";
      audioCache.current[id] = fallback;
      setCurrentTrack({ id, src: fallback, title });
      setIsPlaying(true);
      toast.info("Using sample audio (backend unavailable)", { id: `gen-${id}` });
    } finally {
      clearTimeout(timeoutId);
      if (generatingIdRef.current === id) generatingIdRef.current = null;
      setGeneratingAudio((prev) => (prev === id ? null : prev));
    }
  }, []);

  // Clear generating state when the briefing is no longer in the list (e.g. user removed interests)
  useEffect(() => {
    if (!generatingAudio) return;
    const inList = filteredBriefings.some((b) => b.id === generatingAudio);
    if (!inList) {
      generatingIdRef.current = null;
      setGeneratingAudio(null);
    }
  }, [filteredBriefings, generatingAudio]);

  // Clear generating state on unmount
  useEffect(() => {
    return () => {
      generatingIdRef.current = null;
      setGeneratingAudio(null);
    };
  }, []);

  const handlePause = useCallback(() => {
    setIsPlaying(false);
  }, []);

  const currentIndex = currentTrack ? filteredBriefings.findIndex(b => b.id === currentTrack.id) : -1;

  const handleSkipNext = useCallback(() => {
    const idx = currentTrack ? filteredBriefings.findIndex(b => b.id === currentTrack.id) : -1;
    if (idx >= 0 && idx < filteredBriefings.length - 1) {
      const next = filteredBriefings[idx + 1];
      setCurrentTrack({ id: next.id, src: audioCache.current[next.id] || next.audioUrl, title: next.title });
      setIsPlaying(true);
    }
  }, [currentTrack, filteredBriefings]);

  const handleSkipPrevious = useCallback(() => {
    const idx = currentTrack ? filteredBriefings.findIndex(b => b.id === currentTrack.id) : -1;
    if (idx > 0) {
      const prev = filteredBriefings[idx - 1];
      setCurrentTrack({ id: prev.id, src: audioCache.current[prev.id] || prev.audioUrl, title: prev.title });
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

            {hasFavourites ? (
              <>
                <div className="space-y-3">
                  <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    Your {freqLabel} Briefings
                  </h3>
                  {briefingsLoading ? (
                    <p className="text-sm text-muted-foreground py-4">Loading briefings…</p>
                  ) : filteredBriefings.length === 0 ? (
                    <p className="text-sm text-muted-foreground py-6">
                      No briefings yet. Add sources in Explore to get personalized briefings from your feeds.
                    </p>
                  ) : (
                    filteredBriefings.map((b, i) => (
                      <BriefingCard
                        key={b.id}
                        id={b.id}
                        title={b.title}
                        description={b.description}
                        duration={b.duration}
                        topics={b.topics}
                        confidence={b.confidence}
                        summary={b.summary}
                        icon={b.icon}
                        audioUrl={audioCache.current[b.id] || b.audioUrl}
                        index={i}
                        isPremium={isPremium}
                        isCurrentlyPlaying={isPlaying && currentTrack?.id === b.id}
                        isGenerating={generatingAudio === b.id}
                        onPlay={handlePlay}
                        onPause={handlePause}
                        onPremiumClick={() => setPremiumOpen(true)}
                        onVideoClick={(br) => setVideoBriefing(br ? { title: br.title, summary: br.summary ?? "" } : null)}
                      />
                    ))
                  )}
                </div>

                <PremiumBanner showPopup={premiumOpen} onPopupChange={setPremiumOpen} onTrialActivated={() => setIsPremium(true)} />
              </>
            ) : (
              <div className="flex flex-col items-center justify-center py-24 text-center">
                <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center mb-6">
                  <Compass className="w-10 h-10 text-primary" />
                </div>
                <h2 className="font-display text-2xl font-bold text-foreground mb-3">Welcome to Unscrolling</h2>
                <p className="text-muted-foreground max-w-md mb-8">
                  Start by adding your interests — pick topics, regions, and sources you care about, and we'll generate personalized podcast briefings for you.
                </p>
                <button
                  onClick={() => navigate("/explore")}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold hover:bg-primary/90 transition-colors"
                >
                  <Sparkles className="w-5 h-5" />
                  Add Your Interests
                </button>
              </div>
            )}
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

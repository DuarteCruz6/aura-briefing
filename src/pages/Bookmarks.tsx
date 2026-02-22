import { useState, useCallback, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { AppSidebar } from "../components/AppSidebar";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bookmark, Headphones, Loader2 } from "lucide-react";
import { useBookmarks } from "../hooks/useBookmarks";
import { useAudio } from "../contexts/AudioContext";
import { BriefingCard } from "../components/BriefingCard";
import { BackgroundEffects } from "../components/BackgroundEffects";
import { api } from "../lib/api";
import { toast } from "sonner";

const Bookmarks = () => {
  const navigate = useNavigate();
  const { bookmarks, loading } = useBookmarks();
  const {
    currentTrack,
    isPlaying,
    generatingAudio,
    play,
    pause,
    setGenerating,
    getCachedUrl,
    setCachedUrl,
    setPlaylist,
  } = useAudio();
  const [audioProgress, setAudioProgress] = useState(0);
  const audioProgressTargetRef = useRef(0);
  const bookmarksRef = useRef(bookmarks);
  bookmarksRef.current = bookmarks;

  useEffect(() => {
    const playlist = bookmarks.map((b) => ({
      id: `bookmark-${b.id}`,
      title: b.title,
      audioUrl: getCachedUrl(`bookmark-${b.id}`) || b.audio_url || "",
    }));
    setPlaylist(playlist);
  }, [bookmarks, getCachedUrl, setPlaylist]);

  useEffect(() => {
    if (!generatingAudio) return;
    const inList = bookmarks.some((b) => `bookmark-${b.id}` === generatingAudio);
    if (!inList) setGenerating(null);
  }, [bookmarks, generatingAudio, setGenerating]);

  useEffect(() => {
    if (!generatingAudio) return;
    const id = setInterval(() => {
      setAudioProgress((prev) => {
        const target = audioProgressTargetRef.current;
        if (prev >= target) return prev;
        return Math.min(prev + 1, target);
      });
    }, 35);
    return () => clearInterval(id);
  }, [generatingAudio]);

  const handlePlay = useCallback(
    async (id: string, audioUrl: string, title: string) => {
      const playlist = bookmarksRef.current.map((b) => ({
        id: `bookmark-${b.id}`,
        title: b.title,
        audioUrl: getCachedUrl(`bookmark-${b.id}`) || b.audio_url || "",
      }));
      if (audioUrl || getCachedUrl(id)) {
        play(id, audioUrl || getCachedUrl(id)!, title, playlist);
        return;
      }
      if (generatingAudio) return;
      const b = bookmarksRef.current.find((x) => `bookmark-${x.id}` === id);
      if (!b) {
        setGenerating(null);
        return;
      }
      const generateText =
        b.summary?.trim() ||
        (b.description?.trim() ? `Summarize this briefing: ${b.description}` : null) ||
        `Give me a short podcast briefing about: ${b.title}.`;
      setGenerating(id);
      setAudioProgress(0);
      audioProgressTargetRef.current = 0;
      toast.info("Generating podcast audio…", { id: `gen-${id}` });
      const timeoutMs = 90_000;
      const timeoutId = setTimeout(() => {
        setGenerating(null);
        setAudioProgress(0);
        toast.error("Generation took too long. Try again.", { id: `gen-${id}` });
      }, timeoutMs);
      try {
        const blob = await api.generatePodcast(generateText, {
          onProgress: (p) => {
            audioProgressTargetRef.current = p;
          },
        });
        const blobUrl = URL.createObjectURL(blob);
        setCachedUrl(id, blobUrl);
        play(id, blobUrl, title, playlist);
        setAudioProgress(100);
        toast.success("Podcast ready!", { id: `gen-${id}` });
      } catch {
        const fallback = "/audio/podcast.wav";
        setCachedUrl(id, fallback);
        play(id, fallback, title, playlist);
        toast.info("Using sample audio (backend unavailable)", { id: `gen-${id}` });
      } finally {
        clearTimeout(timeoutId);
        setGenerating(null);
        setAudioProgress(0);
      }
    },
    [generatingAudio, getCachedUrl, play, setCachedUrl, setGenerating]
  );

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden relative">
      <BackgroundEffects />
      <AppSidebar activePage="bookmarks" />
      <main className="flex-1 flex flex-col overflow-hidden relative z-10">
        <div className="flex-1 overflow-y-auto scrollbar-thin pb-20 sm:pb-4">
          <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
            <button
              onClick={() => navigate("/")}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
            >
              <ArrowLeft className="w-4 h-4" /> Back to Home
            </button>

            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Bookmark className="w-5 h-5 text-primary" />
              </div>
              <h1 className="font-display text-2xl font-bold text-foreground">Bookmarks</h1>
            </div>
            <p className="text-sm text-muted-foreground mb-6 ml-[52px]">
              Your saved briefings — {bookmarks.length} saved
            </p>

            {loading ? (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-12 text-center">
                <Loader2 className="w-8 h-8 mx-auto mb-4 text-primary animate-spin" />
                <p className="text-muted-foreground">Loading your bookmarks…</p>
              </motion.div>
            ) : bookmarks.length === 0 ? (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-panel p-12 text-center"
              >
                <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
                  <Bookmark className="w-8 h-8 text-muted-foreground" />
                </div>
                <h3 className="font-display text-lg font-semibold text-foreground mb-2">No bookmarks yet</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  Tap the bookmark icon on any briefing to save it here for later.
                </p>
              </motion.div>
            ) : (
              <>
                <div className="space-y-3">
                  <h3 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">
                    Saved briefings
                  </h3>
                  {bookmarks.map((b, i) => (
                    <BriefingCard
                      key={b.id === -1 ? `opt-${b.title}` : String(b.id)}
                      id={`bookmark-${b.id}`}
                      title={b.title}
                      description={b.description ?? ""}
                      duration={b.duration ?? "—"}
                      topics={b.topics ?? []}
                      confidence={85}
                      summary={b.summary ?? undefined}
                      icon={<Headphones className="w-5 h-5" />}
                      index={i}
                      audioUrl={getCachedUrl(`bookmark-${b.id}`) || b.audio_url || ""}
                      isCurrentlyPlaying={isPlaying && currentTrack?.id === `bookmark-${b.id}`}
                      isGenerating={generatingAudio === `bookmark-${b.id}`}
                      generatingProgress={generatingAudio === `bookmark-${b.id}` ? audioProgress : undefined}
                      onPlay={handlePlay}
                      onPause={pause}
                    />
                  ))}
                </div>
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};

export default Bookmarks;

import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AppSidebar } from "../components/AppSidebar";
import { ArrowLeft, Heart, X, ExternalLink, Sparkles, Loader2 } from "lucide-react";
import { useFavourites } from "../hooks/useFavourites";
import { toast } from "sonner";
import { api, type TopicPreference, type SourceEntry } from "../lib/api";

const TOPIC_LABELS: Record<string, string> = {
  ai: "AI & Technology",
  world: "World News",
  markets: "Markets & Finance",
  climate: "Climate & Energy",
  science: "Science",
  politics: "Politics",
  health: "Health",
  culture: "Culture",
  sports: "Sports",
  startups: "Startups",
};

const typeLabels: Record<string, { label: string; color: string }> = {
  topic: { label: "Topic", color: "bg-primary/10 text-primary" },
  region: { label: "Region", color: "bg-accent/10 text-accent" },
  interest: { label: "Interest", color: "bg-[hsl(var(--neon-green))]/10 text-[hsl(var(--neon-green))]" },
  source: { label: "Source", color: "bg-[hsl(var(--neon-purple))]/10 text-[hsl(var(--neon-purple))]" },
};

const Favourites = () => {
  const navigate = useNavigate();
  const { favourites, removeFavourite } = useFavourites();
  const [topicPrefs, setTopicPrefs] = useState<TopicPreference[]>([]);
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    Promise.all([api.getPreferencesTopics(), api.getSources()])
      .then(([topics, srcs]) => {
        setTopicPrefs(topics);
        setSources(srcs);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const topicIds = new Set(Object.keys(TOPIC_LABELS));
  const topicItems = topicPrefs.filter((p) => topicIds.has(p.topic)).map((p) => ({ id: String(p.id), type: "topic" as const, label: TOPIC_LABELS[p.topic] ?? p.topic, prefId: p.id }));
  const interestItems = topicPrefs.filter((p) => !topicIds.has(p.topic)).map((p) => ({ id: String(p.id), type: "interest" as const, label: p.topic, prefId: p.id }));
  const regionItems = favourites.filter((f) => f.type === "region");
  const sourceItems = sources.map((s) => ({ id: String(s.id), type: "source" as const, label: s.url.split("/").pop() ?? s.url, url: s.url, sourceId: s.id }));

  const handleRemoveTopicOrInterest = (prefId: number, label: string) => {
    api.deletePreferencesTopic(prefId).then(() => {
      setTopicPrefs((prev) => prev.filter((p) => p.id !== prefId));
      toast.success(`Removed "${label}" from favourites`);
    }).catch(() => toast.error("Failed to remove"));
  };

  const handleRemoveSource = (sourceId: number, label: string) => {
    api.deleteSource(sourceId).then(() => {
      setSources((prev) => prev.filter((s) => s.id !== sourceId));
      toast.success(`Unfollowed "${label}"`);
    }).catch(() => toast.error("Failed to unfollow"));
  };

  const handleRemoveRegion = (id: string, label: string) => {
    removeFavourite(id, "region");
    toast.success(`Removed "${label}" from favourites`);
  };

  const totalCount = topicItems.length + interestItems.length + regionItems.length + sourceItems.length;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <AppSidebar activePage="favourites" />
      <main className="flex-1 overflow-y-auto scrollbar-thin pb-24">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </button>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-2 mb-1">
              <Heart className="w-5 h-5 text-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Collection</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">Your Favourites</h1>
            <p className="text-muted-foreground max-w-lg">
              Items you've starred from the Explore page — your curated collection of topics, regions, interests and sources.
            </p>
          </motion.div>

          {/* Stats */}
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }} className="flex items-center gap-3 mb-8">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
              <Sparkles className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">
                {loading ? "…" : `${totalCount} favourite${totalCount !== 1 ? "s" : ""}`}
              </span>
            </div>
          </motion.div>

          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
              <Loader2 className="w-4 h-4 animate-spin" />
              Loading…
            </div>
          )}

          {!loading && totalCount === 0 && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-12 text-center">
              <Heart className="w-10 h-10 mx-auto mb-4 text-muted-foreground/40" />
              <p className="text-muted-foreground mb-2">No favourites yet</p>
              <button onClick={() => navigate("/explore")} className="text-sm text-primary hover:underline">
                Go to Explore to add some →
              </button>
            </motion.div>
          )}

          {!loading && topicItems.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
              <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Topics</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <AnimatePresence>
                  {topicItems.map((item) => (
                    <motion.div
                      key={`topic-${item.id}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="glass-panel rounded-xl border border-border/30 p-4 flex items-start gap-3 group hover:border-border/60 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{item.label}</p>
                        <span className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${typeLabels.topic.color}`}>{typeLabels.topic.label}</span>
                      </div>
                      <button onClick={() => handleRemoveTopicOrInterest(item.prefId, item.label)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-1">
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.section>
          )}

          {!loading && interestItems.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
              <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Custom Interests</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <AnimatePresence>
                  {interestItems.map((item) => (
                    <motion.div
                      key={`interest-${item.id}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="glass-panel rounded-xl border border-border/30 p-4 flex items-start gap-3 group hover:border-border/60 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{item.label}</p>
                        <span className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${typeLabels.interest.color}`}>{typeLabels.interest.label}</span>
                      </div>
                      <button onClick={() => handleRemoveTopicOrInterest(item.prefId, item.label)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-1">
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.section>
          )}

          {regionItems.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
              <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Regions</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {regionItems.map((item) => (
                  <motion.div
                    key={`region-${item.id}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-panel rounded-xl border border-border/30 p-4 flex items-start gap-3 group hover:border-border/60 transition-all"
                  >
                    {item.emoji && <span className="text-2xl">{item.emoji}</span>}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-foreground truncate">{item.label}</p>
                      <span className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${typeLabels.region.color}`}>{typeLabels.region.label}</span>
                    </div>
                    <button onClick={() => handleRemoveRegion(item.id, item.label)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-1">
                      <X className="w-4 h-4" />
                    </button>
                  </motion.div>
                ))}
              </div>
            </motion.section>
          )}

          {!loading && sourceItems.length > 0 && (
            <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mb-10">
              <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Followed Sources</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                <AnimatePresence>
                  {sourceItems.map((item) => (
                    <motion.div
                      key={`source-${item.id}`}
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      className="glass-panel rounded-xl border border-border/30 p-4 flex items-start gap-3 group hover:border-border/60 transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground truncate">{item.label}</p>
                        {item.url && (
                          <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-primary hover:underline mt-1 truncate">
                            <ExternalLink className="w-3 h-3 shrink-0" />
                            <span className="truncate">{item.url}</span>
                          </a>
                        )}
                        <span className={`inline-block mt-2 text-[10px] px-2 py-0.5 rounded-full font-semibold uppercase ${typeLabels.source.color}`}>{typeLabels.source.label}</span>
                      </div>
                      <button onClick={() => handleRemoveSource(item.sourceId, item.label)} className="text-muted-foreground hover:text-destructive transition-colors shrink-0 mt-1">
                        <X className="w-4 h-4" />
                      </button>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            </motion.section>
          )}
        </div>
      </main>
    </div>
  );
};

export default Favourites;

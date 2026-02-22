import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AppSidebar } from "../components/AppSidebar";
import { SourcesSection } from "../components/SourcesSection";
import { ArrowLeft, Search, Sparkles, TrendingUp, Heart, Newspaper, ExternalLink, Loader2 } from "lucide-react";
import { useFavourites } from "../hooks/useFavourites";
import { usePreferencesTopics } from "../hooks/usePreferencesTopics";
import { toast } from "sonner";
import { api, type FeedByTopicsResponse } from "../lib/api";

const topics = [
  { id: "ai", label: "AI & Technology", emoji: "🤖", desc: "Artificial intelligence, gadgets & innovation" },
  { id: "world", label: "World News", emoji: "🌍", desc: "Global events & breaking stories" },
  { id: "markets", label: "Markets & Finance", emoji: "📈", desc: "Stocks, crypto & economic trends" },
  { id: "climate", label: "Climate & Energy", emoji: "🌱", desc: "Sustainability & green energy" },
  { id: "science", label: "Science", emoji: "🔬", desc: "Discoveries & research breakthroughs" },
  { id: "politics", label: "Politics", emoji: "🏛️", desc: "Policy, elections & governance" },
  { id: "health", label: "Health", emoji: "🏥", desc: "Medicine, wellness & public health" },
  { id: "culture", label: "Culture", emoji: "🎭", desc: "Arts, entertainment & society" },
  { id: "sports", label: "Sports", emoji: "⚽", desc: "Scores, athletes & competitions" },
  { id: "startups", label: "Startups", emoji: "🚀", desc: "Founders, funding & disruption" },
];

const regions = [
  { id: "global", label: "Global", emoji: "🌐", desc: "Worldwide coverage" },
  { id: "us", label: "United States", emoji: "🇺🇸", desc: "US news & policy" },
  { id: "europe", label: "Europe", emoji: "🇪🇺", desc: "EU & European affairs" },
  { id: "ireland", label: "Ireland", emoji: "🇮🇪", desc: "Irish news & culture" },
  { id: "uk", label: "United Kingdom", emoji: "🇬🇧", desc: "UK headlines" },
  { id: "asia", label: "Asia Pacific", emoji: "🌏", desc: "APAC developments" },
  { id: "middleeast", label: "Middle East", emoji: "🕌", desc: "Regional affairs" },
  { id: "africa", label: "Africa", emoji: "🌍", desc: "African stories & growth" },
  { id: "latam", label: "Latin America", emoji: "🌎", desc: "LATAM news & trends" },
];

const trendingNow = [
  { id: "trend-gpt5", label: "GPT-5 Launch", emoji: "🤖", category: "AI" },
  { id: "trend-fed", label: "Fed Rate Decision", emoji: "📊", category: "Markets" },
  { id: "trend-climate", label: "EU Climate Summit", emoji: "🌿", category: "Climate" },
  { id: "trend-mars", label: "Mars Rover Discovery", emoji: "🔭", category: "Science" },
];

const Explore = () => {
  const navigate = useNavigate();
  const [topicSearch, setTopicSearch] = useState("");
  const [regionSearch, setRegionSearch] = useState("");
  const [suggestions, setSuggestions] = useState<FeedByTopicsResponse | null>(null);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const { addFavourite, removeFavourite, isFavourite } = useFavourites();
  const { topics: apiTopics, addTopic, removeTopic, isTopicSelected } = usePreferencesTopics();

  useEffect(() => {
    if (apiTopics.length === 0) {
      setSuggestions({ topics: [], message: "Add topic preferences first" });
      return;
    }
    let cancelled = false;
    setSuggestionsLoading(true);
    api
      .getFeedByTopics({ max_per_topic: 5 })
      .then((data) => {
        if (!cancelled) setSuggestions(data);
      })
      .catch(() => {
        if (!cancelled) setSuggestions({ topics: [] });
      })
      .finally(() => {
        if (!cancelled) setSuggestionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [apiTopics.length]);

  const toggleTopic = async (label: string) => {
    if (isTopicSelected(label)) {
      const t = apiTopics.find((x) => x.topic.toLowerCase() === label.toLowerCase());
      if (t) {
        await removeTopic(t.id);
        toast.success(`Removed "${label}" from topics`);
      }
    } else {
      try {
        await addTopic(label);
        toast.success(`Added "${label}" to topics`);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "Could not add topic";
        toast.error(msg);
      }
    }
  };

  const toggleRegionFav = (item: { id: string; type: "region"; label: string; emoji?: string; desc?: string }) => {
    if (isFavourite(item.id, "region")) {
      removeFavourite(item.id, "region");
      toast.success(`Removed "${item.label}" from favourites`);
    } else {
      addFavourite({ ...item, type: "region" });
      toast.success(`Added "${item.label}" to favourites`);
    }
  };

  const filteredTopics = useMemo(
    () => topics.filter((t) => t.label.toLowerCase().includes(topicSearch.toLowerCase()) || t.desc.toLowerCase().includes(topicSearch.toLowerCase())),
    [topicSearch]
  );

  const filteredRegions = useMemo(
    () => regions.filter((r) => r.label.toLowerCase().includes(regionSearch.toLowerCase()) || r.desc.toLowerCase().includes(regionSearch.toLowerCase())),
    [regionSearch]
  );

  const showTopics = filteredTopics.length > 0;
  const showRegions = filteredRegions.length > 0;

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <AppSidebar activePage="explore" />
      <main className="flex-1 overflow-y-auto scrollbar-thin pb-24">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </button>

          {/* Hero */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Discover</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">Explore Your World</h1>
            <p className="text-muted-foreground max-w-lg">
              Curate your AI briefings — pick the topics and regions that matter most to you.
            </p>
          </motion.div>

          {/* Trending Now */}
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Trending Now</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {trendingNow.map((item, i) => {
                const faved = isTopicSelected(item.label);
                return (
                  <motion.button
                    key={item.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full glass-panel border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                    onClick={() => toggleTopic(item.label)}
                  >
                    <span className="text-base">{item.emoji}</span>
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold uppercase">{item.category}</span>
                    <Heart className={`w-3.5 h-3.5 transition-colors ${faved ? "fill-primary text-primary" : "text-muted-foreground group-hover:text-primary"}`} />
                  </motion.button>
                );
              })}
            </div>
          </motion.section>

          {/* Suggestions (feed by topics) */}
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Newspaper className="w-4 h-4 text-primary" />
              <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Suggestions for you</h2>
            </div>
            {suggestionsLoading ? (
              <div className="flex items-center justify-center gap-2 py-8 text-muted-foreground">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Loading suggestions…</span>
              </div>
            ) : apiTopics.length === 0 ? (
              <div className="rounded-xl glass-panel border border-border/50 p-6 text-center">
                <p className="text-sm text-muted-foreground mb-1">Add topics above to get personalized article suggestions.</p>
                <p className="text-xs text-muted-foreground">Suggestions are based on your saved topics.</p>
              </div>
            ) : suggestions && suggestions.topics.length > 0 ? (
              <div className="space-y-4">
                {suggestions.topics.map(({ topic, articles }) =>
                  articles.length > 0 ? (
                    <div key={topic}>
                      <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">{topic}</p>
                      <div className="space-y-2">
                        {articles.map((art, i) => (
                          <a
                            key={art.url || i}
                            href={art.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-start gap-2 rounded-lg glass-panel border border-border/30 p-3 hover:border-primary/40 hover:bg-primary/5 transition-all group text-left"
                          >
                            <span className="flex-1 min-w-0">
                              <span className="text-sm font-medium text-foreground line-clamp-2 group-hover:text-primary">{art.title}</span>
                              {art.source && <span className="text-xs text-muted-foreground block mt-0.5">{art.source}</span>}
                            </span>
                            <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                          </a>
                        ))}
                      </div>
                    </div>
                  ) : null
                )}
              </div>
            ) : (
              <div className="rounded-xl glass-panel border border-border/50 p-6 text-center">
                <p className="text-sm text-muted-foreground">No suggestions right now. Try adding more topics.</p>
              </div>
            )}
          </motion.section>

          {/* Follow Sources */}
          <SourcesSection />

          {/* Topics */}
          <section className="mb-12">
            <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Topics</h2>
            <div className="relative mb-5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={topicSearch}
                onChange={(e) => setTopicSearch(e.target.value)}
                onKeyDown={async (e) => {
                  if (e.key === "Enter" && topicSearch.trim()) {
                    const label = topicSearch.trim();
                    if (isTopicSelected(label)) {
                      toast.error("Already in your topics");
                    } else {
                      try {
                        await addTopic(label);
                        toast.success(`Added "${label}" to topics`);
                        setTopicSearch("");
                      } catch (err: unknown) {
                        toast.error(err instanceof Error ? err.message : "Could not add topic");
                      }
                    }
                  }
                }}
                placeholder="Search or add a topic..."
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all text-sm"
              />
            </div>
            {showTopics ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredTopics.map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="glass-panel relative rounded-xl p-4 text-left transition-all border group border-border/30 hover:border-border/60 hover:bg-secondary/30"
                  >
                    <span className="text-2xl block mb-2">{t.emoji}</span>
                    <p className="font-medium text-sm text-foreground">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.desc}</p>
                    <button
                      onClick={() => toggleTopic(t.label)}
                      className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                      title="Add to topics"
                    >
                      <Heart className={`w-3.5 h-3.5 transition-colors ${isTopicSelected(t.label) ? "fill-primary text-primary" : "text-muted-foreground hover:text-primary"}`} />
                    </button>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No matching topics found.</p>
            )}
          </section>

          {/* Regions */}
          <section className="mb-12">
            <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-4">Regions</h2>
            <div className="relative mb-5">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <input
                type="text"
                value={regionSearch}
                onChange={(e) => setRegionSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && regionSearch.trim()) {
                    const label = regionSearch.trim();
                    const id = label.toLowerCase().replace(/\s+/g, "-");
                    if (!isFavourite(id, "region")) {
                      addFavourite({ id, type: "region", label, emoji: "📍" });
                      toast.success(`Added "${label}" to favourites`);
                      setRegionSearch("");
                    } else {
                      toast.error("Already in favourites");
                    }
                  }
                }}
                placeholder="Search or add a region..."
                className="w-full h-10 pl-10 pr-4 rounded-lg bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all text-sm"
              />
            </div>
            {showRegions ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredRegions.map((r, i) => (
                  <motion.div
                    key={r.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="glass-panel relative rounded-xl p-4 text-left transition-all border group border-border/30 hover:border-border/60 hover:bg-secondary/30"
                  >
                    <span className="text-2xl block mb-2">{r.emoji}</span>
                    <p className="font-medium text-sm text-foreground">{r.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.desc}</p>
                    <button
                      onClick={() => toggleRegionFav({ id: r.id, type: "region", label: r.label, emoji: r.emoji, desc: r.desc })}
                      className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                      title="Add to favourites"
                    >
                      <Heart className={`w-3.5 h-3.5 transition-colors ${isFavourite(r.id, "region") ? "fill-primary text-primary" : "text-muted-foreground hover:text-primary"}`} />
                    </button>
                  </motion.div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-4">No matching regions found.</p>
            )}
          </section>
        </div>
      </main>
    </div>
  );
};

export default Explore;

import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AppSidebar } from "../components/AppSidebar";
import { SourcesSection } from "../components/SourcesSection";
import { ArrowLeft, Search, Sparkles, TrendingUp, Heart, Newspaper, ExternalLink, Loader2, Youtube, MapPin } from "lucide-react";
import { useFavourites } from "../hooks/useFavourites";
import { usePreferencesTopics } from "../hooks/usePreferencesTopics";
import { toast } from "sonner";
import { api, type FeedByTopicsResponse, type YoutubeFeedByTopicsResponse } from "../lib/api";

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

/** Extract YouTube video ID from watch or youtu.be URL for embed. */
function youtubeEmbedUrl(watchUrl: string): string | null {
  try {
    const u = new URL(watchUrl);
    if (u.hostname === "youtu.be") return u.pathname.slice(1) || null;
    return u.searchParams.get("v");
  } catch {
    return null;
  }
}

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
  const [youtubeSuggestion, setYoutubeSuggestion] = useState<YoutubeFeedByTopicsResponse | null>(null);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const { addFavourite, removeFavourite, isFavourite } = useFavourites();
  const { topics: apiTopics, addTopic, removeTopic, isTopicSelected } = usePreferencesTopics();

  useEffect(() => {
    if (apiTopics.length === 0) {
      setSuggestions({ topics: [], message: "Add topic preferences first" });
      setYoutubeSuggestion({ video: null, topic: null, message: "Add topic preferences first" });
      return;
    }
    let cancelled = false;
    setSuggestionsLoading(true);
    setYoutubeLoading(true);
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
    api
      .getFeedYoutubeByTopics({ min_views: 10000 })
      .then((data) => {
        if (!cancelled) setYoutubeSuggestion(data);
      })
      .catch(() => {
        if (!cancelled) setYoutubeSuggestion({ video: null, topic: null });
      })
      .finally(() => {
        if (!cancelled) setYoutubeLoading(false);
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
        <div className="max-w-5xl mx-auto px-5 sm:px-6 py-6 sm:py-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6 group"
          >
            <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> Back to Home
          </button>

          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="mb-10"
          >
            <div className="flex items-center gap-2 mb-3">
              <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/15 text-primary">
                <Sparkles className="w-4 h-4" />
              </span>
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Discover</span>
            </div>
            <h1 className="font-display text-3xl sm:text-4xl font-bold text-foreground mb-3 tracking-tight">
              Explore your world
            </h1>
            <p className="text-muted-foreground max-w-xl text-base leading-relaxed">
              Curate your AI briefings — pick topics and regions that matter to you, then get personalized articles and videos.
            </p>
          </motion.div>

          {/* Follow Sources */}
          <SourcesSection />

          {/* Topics + Regions: primary actions side by side on large screens */}
          <div className="grid lg:grid-cols-2 gap-10 lg:gap-12 mb-10">
            {/* Topics */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 }}
              className="mb-0"
            >
              <div className="flex items-center gap-2 mb-4">
                <TrendingUp className="w-4 h-4 text-primary" />
                <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Topics</h2>
              </div>
              <div className="relative mb-4">
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
                <div className="grid grid-cols-2 gap-3">
                  {filteredTopics.map((t, i) => (
                    <motion.button
                      key={t.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.1 + i * 0.02 }}
                      onClick={() => toggleTopic(t.label)}
                      className={`glass-panel relative rounded-xl p-4 text-left transition-all border group hover-lift border-border/30 hover:border-primary/30 hover:bg-primary/5 ${
                        isTopicSelected(t.label) ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : ""
                      }`}
                    >
                      <span className="text-2xl block mb-2">{t.emoji}</span>
                      <p className="font-medium text-sm text-foreground">{t.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.desc}</p>
                      <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center">
                        <Heart
                          className={`w-3.5 h-3.5 transition-colors ${
                            isTopicSelected(t.label) ? "fill-primary text-primary" : "text-muted-foreground group-hover:text-primary"
                          }`}
                        />
                      </span>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6 rounded-xl bg-secondary/30 border border-dashed border-border/50">
                  No matching topics. Try another search or type a topic and press Enter.
                </p>
              )}
            </motion.section>

            {/* Regions */}
            <motion.section
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
            >
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="w-4 h-4 text-primary" />
                <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Regions</h2>
              </div>
              <div className="relative mb-4">
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
                <div className="grid grid-cols-2 gap-3">
                  {filteredRegions.map((r, i) => (
                    <motion.button
                      key={r.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.14 + i * 0.02 }}
                      onClick={() => toggleRegionFav({ id: r.id, type: "region", label: r.label, emoji: r.emoji, desc: r.desc })}
                      className={`glass-panel relative rounded-xl p-4 text-left transition-all border group hover-lift border-border/30 hover:border-primary/30 hover:bg-primary/5 ${
                        isFavourite(r.id, "region") ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : ""
                      }`}
                    >
                      <span className="text-2xl block mb-2">{r.emoji}</span>
                      <p className="font-medium text-sm text-foreground">{r.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.desc}</p>
                      <span className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center">
                        <Heart
                          className={`w-3.5 h-3.5 transition-colors ${
                            isFavourite(r.id, "region") ? "fill-primary text-primary" : "text-muted-foreground group-hover:text-primary"
                          }`}
                        />
                      </span>
                    </motion.button>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-6 rounded-xl bg-secondary/30 border border-dashed border-border/50">
                  No matching regions. Try another search or type a region and press Enter.
                </p>
              )}
            </motion.section>
          </div>

          {/* Trending Now - quick add */}
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.18 }} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Trending now</h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {trendingNow.map((item, i) => {
                const faved = isTopicSelected(item.label);
                return (
                  <motion.button
                    key={item.label}
                    initial={{ opacity: 0, scale: 0.96 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.04 }}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-full border transition-all group hover-lift ${
                      faved
                        ? "border-primary/50 bg-primary/10 text-foreground shadow-[0_0_12px_hsl(var(--primary)/0.15)]"
                        : "glass-panel border-border/50 hover:border-primary/40 hover:bg-primary/5"
                    }`}
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

          {/* Suggestions (feed by topics: YouTube + articles) */}
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="mb-10">
            <div className="flex items-center gap-2 mb-4">
              <Newspaper className="w-4 h-4 text-primary" />
              <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">Suggestions for you</h2>
            </div>
            {apiTopics.length === 0 ? (
              <div className="rounded-xl glass-panel border border-border/50 p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                  <Sparkles className="w-6 h-6 text-primary" />
                </div>
                <p className="text-sm font-medium text-foreground mb-1">Add topics to unlock suggestions</p>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto mb-4">
                  Pick topics above or from “Trending now” — we’ll suggest articles and videos tailored to your interests.
                </p>
                <p className="text-xs text-muted-foreground">Suggestions refresh based on your saved topics.</p>
              </div>
            ) : (
              <div className="space-y-6">
                {/* Suggested YouTube video */}
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 flex items-center gap-1.5">
                    <Youtube className="w-3.5 h-3.5" /> Suggested video
                  </p>
                  {youtubeLoading ? (
                    <div className="flex items-center gap-2 py-4 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading video…</span>
                    </div>
                  ) : youtubeSuggestion?.video ? (
                    <div className="rounded-xl glass-panel border border-border/50 overflow-hidden hover-lift">
                      {youtubeEmbedUrl(youtubeSuggestion.video.url) && (
                        <div className="aspect-video w-full">
                          <iframe
                            src={`https://www.youtube.com/embed/${youtubeEmbedUrl(youtubeSuggestion.video.url)}`}
                            title={youtubeSuggestion.video.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                            allowFullScreen
                            className="w-full h-full"
                          />
                        </div>
                      )}
                      <div className="p-3 flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground line-clamp-2">{youtubeSuggestion.video.title}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">{youtubeSuggestion.video.channel_title}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            {youtubeSuggestion.video.view_count != null && (
                              <span className="text-xs text-muted-foreground">{youtubeSuggestion.video.view_count.toLocaleString()} views</span>
                            )}
                            {youtubeSuggestion.topic && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold uppercase">{youtubeSuggestion.topic}</span>
                            )}
                          </div>
                        </div>
                        <a
                          href={youtubeSuggestion.video.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                          title="Open on YouTube"
                        >
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-lg glass-panel border border-border/30 p-3 text-sm text-muted-foreground">
                      {youtubeSuggestion?.error ? youtubeSuggestion.error : "No suggested video right now. Add topics or try again later."}
                    </div>
                  )}
                </div>

                {/* Suggested articles */}
                <div>
                  <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Suggested articles</p>
                  {suggestionsLoading ? (
                    <div className="flex items-center gap-2 py-4 text-muted-foreground">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span className="text-sm">Loading articles…</span>
                    </div>
                  ) : suggestions && suggestions.topics.length > 0 ? (
                    <div className="space-y-4">
                      {suggestions.topics.map(({ topic, articles }) =>
                        articles.length > 0 ? (
                          <div key={topic}>
                            <p className="text-xs font-medium text-muted-foreground mb-2">{topic}</p>
                            <div className="space-y-2">
                              {articles.map((art, i) => (
                                <a
                                  key={art.url || i}
                                  href={art.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex items-start gap-2 rounded-lg glass-panel border border-border/30 p-3 hover:border-primary/40 hover:bg-primary/5 hover-lift transition-all group text-left"
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
                    <div className="rounded-lg glass-panel border border-border/30 p-3 text-sm text-muted-foreground">
                      No suggested articles right now. Try adding more topics.
                    </div>
                  )}
                </div>
              </div>
            )}
          </motion.section>
        </div>
      </main>
    </div>
  );
};

export default Explore;

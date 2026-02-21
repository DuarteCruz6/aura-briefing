import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AppSidebar } from "../components/AppSidebar";
import { SourcesSection } from "../components/SourcesSection";
import { ArrowLeft, Search, Sparkles, TrendingUp, Plus, X, Heart } from "lucide-react";
import { useFavourites } from "../hooks/useFavourites";
import { toast } from "sonner";

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
  const [customInterests, setCustomInterests] = useState<string[]>(() => {
    const stored = localStorage.getItem("briefcast_custom_interests");
    return stored ? JSON.parse(stored) : [];
  });
  const { addFavourite, removeFavourite, isFavourite } = useFavourites();

  const toggleFav = (item: { id: string; type: "topic" | "region" | "interest" | "source"; label: string; emoji?: string; desc?: string; url?: string; platform?: string }) => {
    if (isFavourite(item.id, item.type)) {
      removeFavourite(item.id, item.type);
      toast.success(`Removed "${item.label}" from favourites`);
    } else {
      addFavourite(item);
      toast.success(`Added "${item.label}" to favourites`);
    }
  };

  const addInterest = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed || customInterests.includes(trimmed)) return;
    const updated = [...customInterests, trimmed];
    setCustomInterests(updated);
    localStorage.setItem("briefcast_custom_interests", JSON.stringify(updated));
  };

  const removeInterest = (interest: string) => {
    const updated = customInterests.filter((i) => i !== interest);
    setCustomInterests(updated);
    localStorage.setItem("briefcast_custom_interests", JSON.stringify(updated));
  };

  const filteredTopics = useMemo(
    () => topics.filter((t) => !isFavourite(t.id, "topic") && (t.label.toLowerCase().includes(topicSearch.toLowerCase()) || t.desc.toLowerCase().includes(topicSearch.toLowerCase()))),
    [topicSearch, isFavourite]
  );

  const filteredRegions = useMemo(
    () => regions.filter((r) => !isFavourite(r.id, "region") && (r.label.toLowerCase().includes(regionSearch.toLowerCase()) || r.desc.toLowerCase().includes(regionSearch.toLowerCase()))),
    [regionSearch, isFavourite]
  );

  const filteredCustom = useMemo(
    () => customInterests.filter((c) => !isFavourite(c, "interest")),
    [customInterests, isFavourite]
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
                const faved = isFavourite(item.id, "topic");
                if (faved) return null;
                return (
                  <motion.button
                    key={item.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + i * 0.05 }}
                    className="flex items-center gap-2 px-4 py-2.5 rounded-full glass-panel border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                    onClick={() => toggleFav({ id: item.id, type: "topic", label: item.label, emoji: item.emoji })}
                  >
                    <span className="text-base">{item.emoji}</span>
                    <span className="text-sm font-medium text-foreground">{item.label}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold uppercase">{item.category}</span>
                    <Heart className="w-3.5 h-3.5 text-muted-foreground group-hover:text-primary transition-colors" />
                  </motion.button>
                );
              })}
            </div>
          </motion.section>

          {/* Custom Interests */}
          <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.22 }} className="mb-12">
            <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">
              Your Custom Interests
            </h2>
            {filteredCustom.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {filteredCustom.map((interest, i) => {
                  const faved = isFavourite(interest, "interest");
                  return (
                    <motion.div
                      key={interest}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: i * 0.03 }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-full glass-panel border border-primary/30 bg-primary/5 group"
                    >
                      <span className="text-base">🎯</span>
                      <span className="text-sm font-medium text-foreground">{interest}</span>
                      <button
                        onClick={() => toggleFav({ id: interest, type: "interest", label: interest, emoji: "🎯" })}
                        className="w-5 h-5 rounded-full flex items-center justify-center transition-colors"
                        title={faved ? "Remove from favourites" : "Add to favourites"}
                      >
                        <Heart className={`w-3.5 h-3.5 ${faved ? "fill-primary text-primary" : "text-muted-foreground hover:text-primary"}`} />
                      </button>
                      <button
                        onClick={() => removeInterest(interest)}
                        className="w-5 h-5 rounded-full bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No custom interests yet. Add keywords like "electric vehicles", "NBA", or "blockchain" to personalize your briefings.
              </p>
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
                placeholder="Search topics..."
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
                      onClick={() => toggleFav({ id: t.id, type: "topic", label: t.label, emoji: t.emoji, desc: t.desc })}
                      className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                      title="Add to favourites"
                    >
                      <Heart className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
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
                placeholder="Search regions..."
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
                      onClick={() => toggleFav({ id: r.id, type: "region", label: r.label, emoji: r.emoji, desc: r.desc })}
                      className="absolute top-2.5 right-2.5 w-6 h-6 rounded-full flex items-center justify-center transition-colors"
                      title="Add to favourites"
                    >
                      <Heart className="w-3.5 h-3.5 text-muted-foreground hover:text-primary" />
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

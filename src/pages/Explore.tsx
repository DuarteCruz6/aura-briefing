import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { AppSidebar } from "../components/AppSidebar";
import { ArrowLeft, Check, Search, Sparkles, TrendingUp, Zap } from "lucide-react";

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
  { label: "GPT-5 Launch", emoji: "🤖", category: "AI" },
  { label: "Fed Rate Decision", emoji: "📊", category: "Markets" },
  { label: "EU Climate Summit", emoji: "🌿", category: "Climate" },
  { label: "Mars Rover Discovery", emoji: "🔭", category: "Science" },
];

const Explore = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [selectedTopics, setSelectedTopics] = useState<string[]>(["ai", "world", "markets"]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>(["global", "ireland"]);

  const toggle = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter((i) => i !== id) : [...list, id]);
  };

  const filteredTopics = useMemo(
    () => topics.filter((t) => t.label.toLowerCase().includes(search.toLowerCase()) || t.desc.toLowerCase().includes(search.toLowerCase())),
    [search]
  );

  const filteredRegions = useMemo(
    () => regions.filter((r) => r.label.toLowerCase().includes(search.toLowerCase()) || r.desc.toLowerCase().includes(search.toLowerCase())),
    [search]
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
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="w-5 h-5 text-primary" />
              <span className="text-xs font-bold text-primary uppercase tracking-wider">Discover</span>
            </div>
            <h1 className="font-display text-3xl font-bold text-foreground mb-2">Explore Your World</h1>
            <p className="text-muted-foreground max-w-lg">
              Curate your AI briefings — pick the topics and regions that matter most to you.
            </p>
          </motion.div>

          {/* Search */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="relative mb-8"
          >
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground pointer-events-none" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search topics, regions, interests..."
              className="w-full h-12 pl-12 pr-4 rounded-xl bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all text-sm"
            />
          </motion.div>

          {/* Trending Now */}
          <motion.section
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
            className="mb-10"
          >
            <div className="flex items-center gap-2 mb-4">
              <TrendingUp className="w-4 h-4 text-primary" />
              <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Trending Now
              </h2>
            </div>
            <div className="flex flex-wrap gap-2">
              {trendingNow.map((item, i) => (
                <motion.button
                  key={item.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.05 }}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-full glass-panel border border-border/50 hover:border-primary/40 hover:bg-primary/5 transition-all group"
                >
                  <span className="text-base">{item.emoji}</span>
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-semibold uppercase">
                    {item.category}
                  </span>
                </motion.button>
              ))}
            </div>
          </motion.section>

          {/* Selection stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="flex items-center gap-3 mb-8"
          >
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20">
              <Zap className="w-3.5 h-3.5 text-primary" />
              <span className="text-xs font-semibold text-primary">
                {selectedTopics.length} topics · {selectedRegions.length} regions selected
              </span>
            </div>
          </motion.div>

          {/* Topics */}
          {showTopics && (
            <section className="mb-12">
              <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">
                Topics
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredTopics.map((t, i) => {
                  const active = selectedTopics.includes(t.id);
                  return (
                    <motion.button
                      key={t.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => toggle(t.id, selectedTopics, setSelectedTopics)}
                      className={`glass-panel relative rounded-xl p-4 text-left transition-all border group ${
                        active
                          ? "border-primary/50 bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
                          : "border-border/30 hover:border-border/60 hover:bg-secondary/30"
                      }`}
                    >
                      <AnimatePresence>
                        {active && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                          >
                            <Check className="w-3 h-3 text-primary-foreground" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <span className="text-2xl block mb-2">{t.emoji}</span>
                      <p className="font-medium text-sm text-foreground">{t.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.desc}</p>
                    </motion.button>
                  );
                })}
              </div>
            </section>
          )}

          {/* Regions */}
          {showRegions && (
            <section className="mb-12">
              <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">
                Regions
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {filteredRegions.map((r, i) => {
                  const active = selectedRegions.includes(r.id);
                  return (
                    <motion.button
                      key={r.id}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                      onClick={() => toggle(r.id, selectedRegions, setSelectedRegions)}
                      className={`glass-panel relative rounded-xl p-4 text-left transition-all border group ${
                        active
                          ? "border-primary/50 bg-primary/10 shadow-[0_0_20px_hsl(var(--primary)/0.15)]"
                          : "border-border/30 hover:border-border/60 hover:bg-secondary/30"
                      }`}
                    >
                      <AnimatePresence>
                        {active && (
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            exit={{ scale: 0 }}
                            className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                          >
                            <Check className="w-3 h-3 text-primary-foreground" />
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <span className="text-2xl block mb-2">{r.emoji}</span>
                      <p className="font-medium text-sm text-foreground">{r.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.desc}</p>
                    </motion.button>
                  );
                })}
              </div>
            </section>
          )}

          {!showTopics && !showRegions && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="glass-panel p-12 text-center"
            >
              <p className="text-muted-foreground">No results for "{search}"</p>
            </motion.div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Explore;

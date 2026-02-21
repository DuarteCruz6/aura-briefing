import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { AppSidebar } from "@/components/AppSidebar";
import { ArrowLeft, Check } from "lucide-react";

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

const Explore = () => {
  const navigate = useNavigate();
  const [selectedTopics, setSelectedTopics] = useState<string[]>(["ai", "world", "markets"]);
  const [selectedRegions, setSelectedRegions] = useState<string[]>(["global", "ireland"]);

  const toggle = (id: string, list: string[], setList: (v: string[]) => void) => {
    setList(list.includes(id) ? list.filter((i) => i !== id) : [...list, id]);
  };

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

          <h1 className="font-display text-2xl font-bold text-foreground mb-1">Explore</h1>
          <p className="text-sm text-muted-foreground mb-10">Choose the topics and regions that matter to you</p>

          {/* Topics */}
          <section className="mb-12">
            <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">
              Topics
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {topics.map((t, i) => {
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
                        : "border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.03]"
                    }`}
                  >
                    {active && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </motion.div>
                    )}
                    <span className="text-2xl block mb-2">{t.emoji}</span>
                    <p className="font-medium text-sm text-foreground">{t.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{t.desc}</p>
                  </motion.button>
                );
              })}
            </div>
          </section>

          {/* Regions */}
          <section>
            <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">
              Regions
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {regions.map((r, i) => {
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
                        : "border-white/[0.06] hover:border-white/[0.15] hover:bg-white/[0.03]"
                    }`}
                  >
                    {active && (
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="absolute top-2.5 right-2.5 w-5 h-5 rounded-full bg-primary flex items-center justify-center"
                      >
                        <Check className="w-3 h-3 text-primary-foreground" />
                      </motion.div>
                    )}
                    <span className="text-2xl block mb-2">{r.emoji}</span>
                    <p className="font-medium text-sm text-foreground">{r.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{r.desc}</p>
                  </motion.button>
                );
              })}
            </div>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Explore;

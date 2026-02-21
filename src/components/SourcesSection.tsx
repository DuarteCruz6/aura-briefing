import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ExternalLink, Youtube, Linkedin, Twitter, Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useFavourites } from "../hooks/useFavourites";
import { api, type SourceEntry } from "../lib/api";

const platforms = [
  {
    id: "youtube",
    label: "YouTube",
    icon: Youtube,
    baseUrl: "https://youtube.com/@",
    placeholder: "channel or channel-name",
    color: "text-red-500",
  },
  {
    id: "x",
    label: "X / Twitter",
    icon: Twitter,
    baseUrl: "https://x.com/",
    placeholder: "username",
    color: "text-foreground",
  },
  {
    id: "linkedin",
    label: "LinkedIn",
    icon: Linkedin,
    baseUrl: "https://linkedin.com/in/",
    placeholder: "profile-name",
    color: "text-blue-500",
  },
] as const;

export const SourcesSection = () => {
  const [activePlatform, setActivePlatform] = useState<string>("youtube");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const { addFavourite, removeFavourite, isFavourite } = useFavourites();

  const loadSources = useCallback(async () => {
    setLoading(true);
    try {
      const list = await api.getSources();
      setSources(list);
    } catch {
      toast.error("Could not load sources. Check your connection.");
      setSources([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSources();
  }, [loadSources]);

  const handleAdd = async () => {
    const trimmed = sourceUrl.trim().replace(/^\/+/, "");
    if (!trimmed) return;
    const fullUrl = platformMeta.baseUrl + trimmed;
    if (sources.some((s) => s.url === fullUrl)) {
      toast.error("You're already following this source");
      return;
    }
    setAdding(true);
    try {
      const created = await api.addSource({
        type: activePlatform,
        url: fullUrl,
        frequency: "daily",
      });
      setSources((prev) => [created, ...prev]);
      setSourceUrl("");
      toast.success("Source added!");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Failed to add source";
      if (msg.includes("already following")) {
        toast.error("You're already following this source");
      } else {
        toast.error(msg);
      }
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (source: SourceEntry) => {
    setDeletingId(source.id);
    try {
      await api.deleteSource(source.id);
      setSources((prev) => prev.filter((s) => s.id !== source.id));
      toast.success("Source removed");
    } catch {
      toast.error("Failed to remove source");
    } finally {
      setDeletingId(null);
    }
  };

  const toggleFavSource = (source: SourceEntry) => {
    const favId = String(source.id);
    if (isFavourite(favId, "source")) {
      removeFavourite(favId, "source");
      toast.success("Removed from favourites");
    } else {
      addFavourite({
        id: favId,
        type: "source",
        label: source.url.split("/").pop() || source.url,
        url: source.url,
        platform: source.type,
      });
      toast.success("Added to favourites");
    }
  };

  const platformMeta = platforms.find((p) => p.id === activePlatform)!;
  const filteredSources = sources.filter((s) => s.type === activePlatform);

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="mb-12"
    >
      <h2 className="font-display text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-5">
        Follow Sources
      </h2>

      {/* Platform tabs */}
      <div className="flex gap-2 mb-6">
        {platforms.map((p) => {
          const Icon = p.icon;
          const active = activePlatform === p.id;
          const count = sources.filter((s) => s.type === p.id).length;
          return (
            <button
              key={p.id}
              onClick={() => setActivePlatform(p.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                active
                  ? "border-primary/50 bg-primary/10 text-foreground shadow-[0_0_16px_hsl(var(--primary)/0.1)]"
                  : "border-border/30 text-muted-foreground hover:border-border/60 hover:bg-secondary/30"
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? p.color : ""}`} />
              {p.label}
              {count > 0 && <span className="text-xs opacity-60">({count})</span>}
            </button>
          );
        })}
      </div>

      {/* Add source */}
      <div className="flex gap-3 mb-6">
        <div className="flex flex-1 h-10 rounded-lg bg-secondary/50 border border-border/50 focus-within:ring-2 focus-within:ring-primary/30 focus-within:border-primary/50 transition-all overflow-hidden">
          <span className="flex items-center pl-3 text-sm text-muted-foreground whitespace-nowrap select-none">
            {platformMeta.baseUrl}
          </span>
          <input
            type="text"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={platformMeta.placeholder}
            className="flex-1 h-full bg-transparent border-none text-foreground placeholder:text-muted-foreground focus:outline-none text-sm px-1"
          />
        </div>
        <button
          onClick={handleAdd}
          disabled={!sourceUrl.trim() || adding}
          className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Follow
        </button>
      </div>

      {/* Source list */}
      {loading ? (
        <div className="glass-panel rounded-xl border border-border/20 p-8 text-center">
          <Loader2 className="w-8 h-8 mx-auto mb-3 text-muted-foreground animate-spin" />
          <p className="text-sm text-muted-foreground">Loading sources…</p>
        </div>
      ) : filteredSources.length === 0 ? (
        <div className="glass-panel rounded-xl border border-border/20 p-8 text-center">
          <platformMeta.icon className={`w-8 h-8 mx-auto mb-3 ${platformMeta.color} opacity-40`} />
          <p className="text-sm text-muted-foreground">
            No {platformMeta.label} sources yet. Paste a link above to start following.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filteredSources.map((source) => {
              const Icon = platformMeta.icon;
              const favId = String(source.id);
              const faved = isFavourite(favId, "source");
              const isDeleting = deletingId === source.id;
              return (
                <motion.div
                  key={source.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="glass-panel rounded-xl border border-border/30 p-4 flex items-center gap-3 group hover:border-border/60 transition-all"
                >
                  <Icon className={`w-5 h-5 ${platformMeta.color} shrink-0`} />
                  <p className="flex-1 text-sm font-medium text-foreground truncate">{source.url}</p>
                  <button
                    onClick={() => toggleFavSource(source)}
                    className="transition-colors"
                    title={faved ? "Remove from favourites" : "Add to favourites"}
                  >
                    <Heart
                      className={`w-4 h-4 ${faved ? "fill-primary text-primary" : "text-muted-foreground hover:text-primary"}`}
                    />
                  </button>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleDelete(source)}
                    disabled={isDeleting}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
                  >
                    {isDeleting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.section>
  );
};

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Trash2, ExternalLink, Youtube, Linkedin, Twitter, Loader2 } from "lucide-react";
import { api, type SourceEntry } from "../lib/api";
import { toast } from "sonner";

const platforms = [
  { id: "youtube", label: "YouTube", icon: Youtube, placeholder: "https://youtube.com/@channel", color: "text-red-500" },
  { id: "x", label: "X / Twitter", icon: Twitter, placeholder: "https://x.com/username", color: "text-foreground" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "https://linkedin.com/in/profile", color: "text-blue-500" },
] as const;

export const SourcesSection = () => {
  const [activePlatform, setActivePlatform] = useState<string>("youtube");
  const [sourceUrl, setSourceUrl] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sources, setSources] = useState<SourceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);

  useEffect(() => {
    api.getSources()
      .then(setSources)
      .catch(() => {})
      .finally(() => setFetching(false));
  }, []);

  const handleAdd = async () => {
    const trimmedUrl = sourceUrl.trim();
    if (!trimmedUrl) return;

    setLoading(true);
    try {
      const newSource = await api.addSource({
        type: activePlatform,
        url: trimmedUrl,
        name: sourceName.trim() || undefined,
      });
      setSources((prev) => [newSource, ...prev]);
      setSourceUrl("");
      setSourceName("");
      toast.success("Source added!");
    } catch (err: any) {
      toast.error(err.message || "Failed to add source");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      await api.deleteSource(id);
      setSources((prev) => prev.filter((s) => s.id !== id));
      toast.success("Source removed");
    } catch {
      toast.error("Failed to remove source");
    }
  };

  const filteredSources = sources.filter((s) => s.type === activePlatform);
  const platformMeta = platforms.find((p) => p.id === activePlatform)!;

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
              <span className="text-xs opacity-60">
                ({sources.filter((s) => s.type === p.id).length})
              </span>
            </button>
          );
        })}
      </div>

      {/* Add source form */}
      <div className="glass-panel rounded-xl border border-border/30 p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3">
          <input
            type="text"
            value={sourceName}
            onChange={(e) => setSourceName(e.target.value)}
            placeholder="Label (optional)"
            className="sm:w-40 h-10 px-3 rounded-lg bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
          <input
            type="url"
            value={sourceUrl}
            onChange={(e) => setSourceUrl(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            placeholder={platformMeta.placeholder}
            className="flex-1 h-10 px-3 rounded-lg bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 text-sm"
          />
          <button
            onClick={handleAdd}
            disabled={loading || !sourceUrl.trim()}
            className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            Follow
          </button>
        </div>
      </div>

      {/* Source list */}
      {fetching ? (
        <div className="flex justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : filteredSources.length === 0 ? (
        <div className="glass-panel rounded-xl border border-border/20 p-8 text-center">
          <platformMeta.icon className={`w-8 h-8 mx-auto mb-3 ${platformMeta.color} opacity-40`} />
          <p className="text-sm text-muted-foreground">
            No {platformMeta.label} sources yet. Add a channel or profile URL above to start following.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <AnimatePresence>
            {filteredSources.map((source) => {
              const Icon = platformMeta.icon;
              return (
                <motion.div
                  key={source.id}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="glass-panel rounded-xl border border-border/30 p-4 flex items-center gap-3 group hover:border-border/60 transition-all"
                >
                  <Icon className={`w-5 h-5 ${platformMeta.color} shrink-0`} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {source.name || source.url}
                    </p>
                    {source.name && (
                      <p className="text-xs text-muted-foreground truncate">{source.url}</p>
                    )}
                  </div>
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                  <button
                    onClick={() => handleDelete(source.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 sm:opacity-100"
                  >
                    <Trash2 className="w-4 h-4" />
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

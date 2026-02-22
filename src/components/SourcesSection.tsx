import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Youtube, Linkedin, Twitter, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useSources } from "../hooks/useSources";
import { getSourceDisplayName } from "../lib/utils";

const platforms = [
  { id: "youtube", label: "YouTube", icon: Youtube, color: "text-red-500", placeholder: "e.g. https://youtube.com/@MrBeast" },
  { id: "x", label: "X / Twitter", icon: Twitter, color: "text-foreground", placeholder: "e.g. https://x.com/elonmusk" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, color: "text-blue-500", placeholder: "e.g. https://linkedin.com/in/satyanadella" },
] as const;

/** Allowed URL patterns per platform: YouTube channels, X users, LinkedIn profiles only. */
const URL_PATTERNS: Record<string, RegExp> = {
  youtube: /^(https?:\/\/)?(www\.)?youtube\.com\/(channel\/[^/?#]+|@[^/?#]+|c\/[^/?#]+|user\/[^/?#]+)/i,
  x: /^(https?:\/\/)?(www\.)?(x\.com|twitter\.com)\/[a-zA-Z0-9_]{1,15}\/?$/i,
  linkedin: /^(https?:\/\/)?(www\.)?linkedin\.com\/in\/[^/?#]+/i,
};

function validateSourceUrl(url: string, platformId: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return "Enter a URL";
  try {
    new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return "Enter a valid URL";
  }
  const normalized = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
  const re = URL_PATTERNS[platformId];
  if (!re || !re.test(normalized)) {
    if (platformId === "youtube") return "Use a YouTube channel URL (e.g. youtube.com/@handle or youtube.com/channel/...)";
    if (platformId === "x") return "Use an X or Twitter profile URL (e.g. x.com/username)";
    if (platformId === "linkedin") return "Use a LinkedIn profile URL (e.g. linkedin.com/in/username)";
    return "Invalid URL for this platform";
  }
  return null;
}

export const SourcesSection = () => {
  const [activePlatform, setActivePlatform] = useState<string>("youtube");
  const [sourceUrl, setSourceUrl] = useState("");
  const [adding, setAdding] = useState(false);
  const { sources, addSource, deleteSource, isSourceAdded, loading } = useSources();

  const handlePlatformSwitch = (platformId: string) => {
    setActivePlatform(platformId);
    setSourceUrl("");
  };

  const handleAdd = async () => {
    const trimmed = sourceUrl.trim();
    if (!trimmed) return;
    const validationError = validateSourceUrl(trimmed, activePlatform);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    if (isSourceAdded(trimmed)) {
      toast.error("You're already following this source");
      return;
    }
    const normalizedUrl = trimmed.startsWith("http") ? trimmed : `https://${trimmed}`;
    const displayName = getSourceDisplayName(normalizedUrl, activePlatform);
    setAdding(true);
    try {
      await addSource({ type: activePlatform, url: normalizedUrl, name: displayName });
      setSourceUrl("");
      toast.success("Source added!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Could not add source";
      toast.error(msg);
    } finally {
      setAdding(false);
    }
  };

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
              onClick={() => handlePlatformSwitch(p.id)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                active
                  ? "border-primary/50 bg-primary/10 text-foreground shadow-[0_0_16px_hsl(var(--primary)/0.1)]"
                  : "border-border/30 text-muted-foreground hover:border-border/60 hover:bg-secondary/30"
              }`}
            >
              <Icon className={`w-4 h-4 ${active ? p.color : ""}`} />
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Add source */}
      <div className="flex gap-3">
        <input
          type="text"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          placeholder={platformMeta.placeholder}
          className="flex-1 h-10 px-4 rounded-lg bg-secondary/50 border border-border/50 text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 transition-all text-sm"
        />
        <button
          onClick={handleAdd}
          disabled={!sourceUrl.trim() || adding}
          className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          Add
        </button>
      </div>

      {/* Followed sources list */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading sources…
        </div>
      ) : sources.length > 0 ? (
        <div className="mt-4 space-y-2">
          <p className="text-xs text-muted-foreground uppercase tracking-wider font-semibold">Following ({sources.length})</p>
          {sources.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 py-2 px-3 rounded-lg bg-secondary/30 border border-border/30"
            >
              <span className="text-sm text-foreground truncate">{s.name || getSourceDisplayName(s.url ?? "", s.type)}</span>
              <button
                onClick={() => deleteSource(s.id)}
                className="shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                title="Unfollow"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      ) : null}
    </motion.section>
  );
};

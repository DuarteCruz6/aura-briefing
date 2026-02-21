import { useState } from "react";
import { motion } from "framer-motion";
import { Plus, Youtube, Linkedin, Twitter } from "lucide-react";
import { toast } from "sonner";
import { useFavourites } from "../hooks/useFavourites";

const platforms = [
  { id: "youtube", label: "YouTube", icon: Youtube, color: "text-red-500", placeholder: "e.g. https://youtube.com/@MrBeast" },
  { id: "x", label: "X / Twitter", icon: Twitter, color: "text-foreground", placeholder: "e.g. https://x.com/elonmusk" },
  { id: "linkedin", label: "LinkedIn", icon: Linkedin, color: "text-blue-500", placeholder: "e.g. https://linkedin.com/in/satyanadella" },
] as const;

export const SourcesSection = () => {
  const [activePlatform, setActivePlatform] = useState<string>("youtube");
  const [sourceUrl, setSourceUrl] = useState("");
  const { addFavourite, isFavourite } = useFavourites();

  const handlePlatformSwitch = (platformId: string) => {
    setActivePlatform(platformId);
    setSourceUrl("");
  };

  const handleAdd = () => {
    const trimmed = sourceUrl.trim();
    if (!trimmed) return;
    if (isFavourite(trimmed, "source")) {
      toast.error("You've already added this source");
      return;
    }
    addFavourite({
      id: trimmed,
      type: "source",
      label: trimmed.split("/").pop() || trimmed,
      url: trimmed,
      platform: activePlatform,
    });
    setSourceUrl("");
    toast.success("Source added to favourites!");
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
          disabled={!sourceUrl.trim()}
          className="h-10 px-5 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center gap-2 shrink-0"
        >
          <Plus className="w-4 h-4" /> Add
        </button>
      </div>
    </motion.section>
  );
};

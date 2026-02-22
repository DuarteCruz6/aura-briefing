import { motion } from "framer-motion";
import { AppSidebar } from "../components/AppSidebar";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bookmark, Clock, TrendingUp, Trash2, Loader2 } from "lucide-react";
import { useBookmarks } from "../hooks/useBookmarks";

const Bookmarks = () => {
  const navigate = useNavigate();
  const { bookmarks, removeBookmark, loading } = useBookmarks();

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden">
      <AppSidebar activePage="bookmarks" />
      <main className="flex-1 overflow-y-auto scrollbar-thin pb-24">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="w-4 h-4" /> Back to Home
          </button>

          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
              <Bookmark className="w-5 h-5 text-primary" />
            </div>
            <h1 className="font-display text-2xl font-bold text-foreground">Bookmarks</h1>
          </div>
          <p className="text-sm text-muted-foreground mb-8 ml-[52px]">
            Your saved briefings — {bookmarks.length} saved
          </p>

          {loading ? (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass-panel p-12 text-center">
              <Loader2 className="w-8 h-8 mx-auto mb-4 text-primary animate-spin" />
              <p className="text-muted-foreground">Loading your bookmarks…</p>
            </motion.div>
          ) : bookmarks.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass-panel p-12 text-center"
            >
              <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
                <Bookmark className="w-8 h-8 text-muted-foreground" />
              </div>
              <h3 className="font-display text-lg font-semibold text-foreground mb-2">No bookmarks yet</h3>
              <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                Tap the bookmark icon on any briefing to save it here for later.
              </p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              {bookmarks.map((b, i) => (
                <motion.div
                  key={b.id}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-panel hover-lift p-5 group"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-display font-semibold text-foreground">{b.title}</h3>
                      <p className="text-sm text-muted-foreground">{b.description ?? ""}</p>
                    </div>
                    <button
                      onClick={() => removeBookmark(b.id)}
                      className="w-9 h-9 rounded-full bg-destructive/10 flex items-center justify-center text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {b.duration ?? "—"}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-3">
                    {(b.topics ?? []).map((topic) => (
                      <span key={topic} className="px-2.5 py-1 rounded-full bg-secondary text-secondary-foreground text-xs font-medium">
                        {topic}
                      </span>
                    ))}
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default Bookmarks;

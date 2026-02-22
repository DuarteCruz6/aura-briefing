import { X, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useState, useRef, useEffect, useCallback } from "react";
import { api } from "../lib/api";

interface VideoPlayerPopupProps {
  open: boolean;
  onClose: () => void;
  title: string;
  summary: string;
  isPremium: boolean;
}

type Status = "idle" | "loading" | "ready" | "error";

export function VideoPlayerPopup({ open, onClose, title, summary, isPremium }: VideoPlayerPopupProps) {
  const [status, setStatus] = useState<Status>("idle");
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  // When popup closes, clear state and revoke blob URL
  useEffect(() => {
    if (!open) {
      setStatus("idle");
      setProgress(0);
      setErrorMessage(null);
      if (videoUrl) {
        URL.revokeObjectURL(videoUrl);
        setVideoUrl(null);
      }
    }
  }, [open, videoUrl]);

  const [progress, setProgress] = useState(0);
  const progressTargetRef = useRef(0);

  const setProgressTarget = useCallback((p: number) => {
    progressTargetRef.current = p;
  }, []);

  // Smooth progress: animate displayed progress 1% at a time toward latest backend value
  useEffect(() => {
    if (status !== "loading") return;
    const id = setInterval(() => {
      setProgress((prev) => {
        const target = progressTargetRef.current;
        if (prev >= target) return prev;
        return Math.min(prev + 1, target);
      });
    }, 35);
    return () => clearInterval(id);
  }, [status]);

  // When popup opens with summary, start video generation (real progress via backend SSE)
  useEffect(() => {
    if (!open) return;
    if (!summary?.trim() || !isPremium) {
      setStatus("error");
      setErrorMessage(
        !isPremium ? "Premium required to generate video." : "No summary available for this briefing."
      );
      return;
    }

    let cancelled = false;
    setStatus("loading");
    setErrorMessage(null);
    setProgress(0);
    progressTargetRef.current = 0;

    api
      .generateVideo({ title, summary }, true, { onProgress: setProgressTarget })
      .then((blob) => {
        if (cancelled) return;
        setProgress(100);
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setStatus("ready");
      })
      .catch((err: Error) => {
        if (cancelled) return;
        setStatus("error");
        setErrorMessage(err.message ?? "Video generation failed.");
      });

    return () => {
      cancelled = true;
    };
  }, [open, title, summary, isPremium]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="relative w-full max-w-2xl mx-4 rounded-2xl bg-card border border-border overflow-hidden shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/50">
              <div>
                <p className="text-xs text-primary font-semibold uppercase tracking-wider">AI Video Briefing</p>
                <h3 className="font-display font-semibold text-foreground text-sm">{title}</h3>
              </div>
              <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative aspect-video bg-background flex items-center justify-center">
              {status === "loading" && (
                <div className="flex flex-col items-center gap-4 w-full max-w-sm px-6">
                  <Loader2 className="w-12 h-12 text-primary animate-spin" />
                  <p className="text-sm text-muted-foreground">Generating video…</p>
                  <div className="w-full space-y-2">
                    <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full bg-primary transition-all duration-300 ease-out rounded-full"
                        style={{ width: `${progress}%` }}
                      />
                    </div>
                    <p className="text-center text-sm font-medium text-foreground tabular-nums">{progress}%</p>
                  </div>
                  <p className="text-xs text-muted-foreground/80">TTS + visuals, this may take a moment.</p>
                </div>
              )}

              {status === "error" && (
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <AlertCircle className="w-10 h-10 text-destructive" />
                  <p className="text-sm text-foreground font-medium">Something went wrong</p>
                  <p className="text-xs text-muted-foreground">{errorMessage}</p>
                </div>
              )}

              {status === "ready" && videoUrl && (
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  className="w-full h-full object-contain"
                  playsInline
                />
              )}
            </div>

            {status === "ready" && (
              <div className="px-5 py-2 border-t border-border/50">
                <p className="text-xs text-muted-foreground text-center">Your AI-generated briefing video</p>
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

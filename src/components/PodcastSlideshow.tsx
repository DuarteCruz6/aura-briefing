import { useMemo, useEffect, useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAudio } from "../contexts/AudioContext";
import { api } from "../lib/api";

const STOPWORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by", "from",
  "is", "are", "was", "were", "be", "been", "being", "have", "has", "had", "do", "does", "did",
  "will", "would", "could", "should", "may", "might", "must", "shall", "can", "need", "dare",
  "it", "its", "this", "that", "these", "those", "i", "you", "he", "she", "we", "they",
  "as", "so", "if", "than", "when", "while", "where", "because", "until", "about", "into", "through",
]);

/** Split text into sentences (rough). */
function getSentences(text: string): string[] {
  const trimmed = (text || "").trim();
  if (!trimmed) return [];
  return trimmed.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean);
}

/** Extract 1–3 search keywords from a sentence: drop stopwords, take longer words. */
function extractKeywords(sentence: string, maxWords = 3): string {
  const words = sentence
    .toLowerCase()
    .replace(/[^\w\s'-]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w));
  const byLen = [...words].sort((a, b) => b.length - a.length);
  const chosen = byLen.slice(0, maxWords);
  return chosen.join(" ").trim() || "news";
}

/**
 * Slideshow synced to podcast playback: derives keywords from the current part of the
 * transcript and shows a matching image, with smooth transitions as the content changes.
 */
export function PodcastSlideshow() {
  const { currentTrack, playbackState } = useAudio();
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [prevUrl, setPrevUrl] = useState<string | null>(null);
  const cacheRef = useRef<Record<string, string>>({});
  const lastQueryRef = useRef<string>("");
  const currentUrlRef = useRef<string | null>(null);

  const { currentQuery } = useMemo(() => {
    if (!playbackState?.segments?.length || playbackState.duration <= 0) {
      return { currentQuery: "" };
    }
    const full = playbackState.segments.map((s) => s.text).join("\n");
    const sentences = getSentences(full);
    if (!sentences.length) return { currentQuery: "news" };

    const progress = Math.min(1, Math.max(0, playbackState.currentTime / playbackState.duration));
    const totalChars = full.length;
    const charIndex = progress * totalChars;

    let acc = 0;
    let currentSentence = sentences[0];
    for (const sent of sentences) {
      acc += sent.length + 1;
      if (acc >= charIndex) {
        currentSentence = sent;
        break;
      }
    }
    const query = extractKeywords(currentSentence);
    return { currentQuery: query };
  }, [playbackState?.currentTime, playbackState?.duration, playbackState?.segments]);

  useEffect(() => {
    if (!currentQuery || currentQuery === lastQueryRef.current) return;
    lastQueryRef.current = currentQuery;

    const cached = cacheRef.current[currentQuery];
    if (cached) {
      setPrevUrl(currentUrlRef.current);
      currentUrlRef.current = cached;
      setImageUrl(cached);
      return;
    }

    api
      .getSlideshowImage(currentQuery)
      .then(({ url }) => {
        cacheRef.current[currentQuery] = url;
        setPrevUrl(currentUrlRef.current);
        currentUrlRef.current = url;
        setImageUrl(url);
      })
      .catch(() => {
        cacheRef.current[currentQuery] = "";
        setPrevUrl(currentUrlRef.current);
        setImageUrl(null);
      });
  }, [currentQuery]);

  if (!currentTrack) return null;

  if (!playbackState?.segments?.length) {
    return (
      <div className="rounded-2xl overflow-hidden border border-border/40 bg-secondary/30 aspect-video max-w-2xl w-full flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Syncing to transcript…</span>
      </div>
    );
  }

  const showUrl = imageUrl || prevUrl;
  if (!showUrl) {
    return (
      <div className="rounded-2xl overflow-hidden border border-border/40 bg-secondary/30 aspect-video max-w-2xl w-full flex items-center justify-center">
        <span className="text-sm text-muted-foreground">Loading slide…</span>
      </div>
    );
  }

  return (
    <div className="rounded-2xl overflow-hidden border border-border/40 bg-secondary/30 aspect-video max-w-2xl w-full relative">
      <AnimatePresence mode="wait">
        <motion.div
          key={showUrl}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.6, ease: "easeInOut" }}
          className="absolute inset-0"
        >
          <img
            src={showUrl}
            alt=""
            className="w-full h-full object-cover"
            loading="eager"
          />
        </motion.div>
      </AnimatePresence>
      <div className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
    </div>
  );
}

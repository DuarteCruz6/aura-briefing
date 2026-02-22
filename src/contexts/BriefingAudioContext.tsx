import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useMemo,
  type ReactNode,
} from "react";
import { toast } from "sonner";
import { api } from "../lib/api";

export interface BriefingPlayOptions {
  generateUrls?: string[];
  generateText?: string;
  isCombined?: boolean;
}

interface BriefingAudioContextValue {
  generatingId: string | null;
  currentTrack: { id: string; src: string; title: string } | null;
  isPlaying: boolean;
  /** Blob URL cache by briefing id. Mutate via .current, read in Index for cards. */
  audioCacheRef: React.MutableRefObject<Record<string, string>>;
  startPlay: (
    id: string,
    audioUrl: string,
    title: string,
    options?: BriefingPlayOptions
  ) => void;
  pause: () => void;
  setCurrentTrack: React.Dispatch<
    React.SetStateAction<{ id: string; src: string; title: string } | null>
  >;
  setIsPlaying: React.Dispatch<React.SetStateAction<boolean>>;
  /** Clear generating state when the briefing is no longer in the list (e.g. user removed interests). Call from Index when filteredBriefings change. */
  clearGeneratingIfNotInList: (briefingIds: string[]) => void;
}

const BriefingAudioContext = createContext<BriefingAudioContextValue | null>(
  null
);

export function BriefingAudioProvider({ children }: { children: ReactNode }) {
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [currentTrack, setCurrentTrack] = useState<{
    id: string;
    src: string;
    title: string;
  } | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const audioCacheRef = useRef<Record<string, string>>({});
  const generatingIdRef = useRef<string | null>(null);

  const clearGeneratingIfNotInList = useCallback((briefingIds: string[]) => {
    setGeneratingId((prev) => {
      if (!prev) return prev;
      if (briefingIds.includes(prev)) return prev;
      generatingIdRef.current = null;
      return null;
    });
  }, []);

  const startPlay = useCallback(
    (
      id: string,
      audioUrl: string,
      title: string,
      options?: BriefingPlayOptions
    ) => {
      if (audioUrl) {
        setCurrentTrack({ id, src: audioUrl, title });
        setIsPlaying(true);
        return;
      }

      if (generatingIdRef.current) return;
      generatingIdRef.current = id;
      setGeneratingId(id);

      const cached = audioCacheRef.current[id];
      if (cached) {
        setCurrentTrack({ id, src: cached, title });
        setIsPlaying(true);
        generatingIdRef.current = null;
        setGeneratingId(null);
        return;
      }

      if (!options) {
        generatingIdRef.current = null;
        setGeneratingId(null);
        return;
      }

      toast.info("Generating your podcast audio…", { id: `gen-${id}` });

      const timeoutMs = 90_000;
      const timeoutId = setTimeout(() => {
        if (generatingIdRef.current === id) generatingIdRef.current = null;
        setGeneratingId((prev) => (prev === id ? null : prev));
        toast.error("Generation took too long. Try again.", { id: `gen-${id}` });
      }, timeoutMs);

      const run = async () => {
        try {
          let blob: Blob;
          if (options.isCombined) {
            blob = await api.generatePersonalBriefingAudio();
          } else if (options.generateUrls?.length) {
            blob = await api.generatePodcastFromUrls(options.generateUrls);
          } else if (options.generateText) {
            blob = await api.generatePodcast(options.generateText);
          } else {
            toast.error("No content available to generate audio", {
              id: `gen-${id}`,
            });
            generatingIdRef.current = null;
            setGeneratingId(null);
            clearTimeout(timeoutId);
            return;
          }
          const blobUrl = URL.createObjectURL(blob);
          audioCacheRef.current[id] = blobUrl;
          setCurrentTrack({ id, src: blobUrl, title });
          setIsPlaying(true);
          toast.success("Podcast ready!", { id: `gen-${id}` });
        } catch (err: unknown) {
          const message =
            err instanceof Error ? err.message : "Backend unavailable";
          toast.error(message, { id: `gen-${id}` });
          generatingIdRef.current = null;
          setGeneratingId((prev) => (prev === id ? null : prev));
        } finally {
          clearTimeout(timeoutId);
          if (generatingIdRef.current === id) generatingIdRef.current = null;
          setGeneratingId((prev) => (prev === id ? null : prev));
        }
      };

      run();
    },
    []
  );

  const pause = useCallback(() => setIsPlaying(false), []);

  const value = useMemo(
    () => ({
      generatingId,
      currentTrack,
      isPlaying,
      audioCacheRef,
      startPlay,
      pause,
      setCurrentTrack,
      setIsPlaying,
      clearGeneratingIfNotInList,
    }),
    [
      generatingId,
      currentTrack,
      isPlaying,
      startPlay,
      pause,
      clearGeneratingIfNotInList,
    ]
  );

  return (
    <BriefingAudioContext.Provider value={value}>
      {children}
    </BriefingAudioContext.Provider>
  );
}

export function useBriefingAudio() {
  const ctx = useContext(BriefingAudioContext);
  if (!ctx)
    throw new Error("useBriefingAudio must be used within BriefingAudioProvider");
  return ctx;
}

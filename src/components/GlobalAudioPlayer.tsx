import { useCallback, useEffect } from "react";
import { toast } from "sonner";
import { useAudio } from "../contexts/AudioContext";
import { api } from "../lib/api";
import { AudioPlayer } from "./AudioPlayer";

/**
 * Renders the global audio player when there is a current track.
 * Stays mounted so playback continues when navigating between pages.
 */
export function GlobalAudioPlayer() {
  const {
    currentTrack,
    isPlaying,
    setPlaying,
    skipNext,
    skipPrevious,
    hasNext,
    hasPrevious,
    refreshCurrentTrackUrl,
  } = useAudio();

  const onRegenerateTranscript = useCallback(async () => {
    if (currentTrack?.id !== "combined-briefing") return;
    try {
      await api.invalidatePersonalBriefing();
      const blob = await api.generatePersonalBriefingAudio();
      const blobUrl = URL.createObjectURL(blob);
      refreshCurrentTrackUrl("combined-briefing", blobUrl);
      toast.success("Transcript regenerated");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to regenerate transcript";
      toast.error(message);
    }
  }, [currentTrack?.id, refreshCurrentTrackUrl]);

  // Spacebar toggles play/pause when audio is active (video popup handles its own space with capture)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== " " && e.code !== "Space") return;
      const t = e.target as HTMLElement;
      if (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT" || t.closest("button") || t.closest("[contenteditable=true]")) return;
      if (!currentTrack) return;
      e.preventDefault();
      setPlaying(!isPlaying);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentTrack, isPlaying, setPlaying]);

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-0 left-0 right-0 z-50 pointer-events-none [&>*]:pointer-events-auto">
      <AudioPlayer
        src={currentTrack.src}
        trackTitle={currentTrack.title}
        briefingId={currentTrack.id}
        externalPlaying={isPlaying}
        onPlayingChange={setPlaying}
        onSkipNext={skipNext}
        onSkipPrevious={skipPrevious}
        hasNext={hasNext}
        hasPrevious={hasPrevious}
        onRegenerateTranscript={currentTrack.id === "combined-briefing" ? onRegenerateTranscript : undefined}
      />
    </div>
  );
}

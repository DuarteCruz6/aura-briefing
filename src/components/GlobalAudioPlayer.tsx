import { useAudio } from "../contexts/AudioContext";
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
  } = useAudio();

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
      />
    </div>
  );
}

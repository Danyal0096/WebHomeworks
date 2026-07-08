import { useEffect, useRef, useState } from "react";
import { repository } from "../../repositories/localRepository";
import { currentTrack, usePlayer } from "../../store/player";
import { useDatabaseVersion } from "../../store/session";

export function AudioEngine() {
  const audio = useRef<HTMLAudioElement>(null); const stallTimer = useRef<number | null>(null); const counted = useRef<string | null>(null);
  const [source, setSource] = useState("");
  useDatabaseVersion();
  const tracks = repository.sessionUser() ? repository.tracks() : [];
  const state = usePlayer(); const track = currentTrack(tracks, state.trackIds, state.currentIndex);

  function handleFailure(trackId: string) {
    state.markFailure(trackId);
    window.setTimeout(() => {
      if (usePlayer.getState().failureCount >= 3) usePlayer.getState().setPlaying(false);
      else usePlayer.getState().next("failure");
    }, 550);
  }

  useEffect(() => {
    const element = audio.current; if (!element) return;
    element.volume = state.volume;
  }, [state.volume]);

  useEffect(() => {
    const element = audio.current; if (!element || !track) return;
    counted.current = null; setSource(""); element.pause(); element.removeAttribute("src"); element.load(); element.currentTime = 0; state.setProgress(0, track.durationSeconds);
    if (!track.isPlayableForViewer || state.unavailableIds.includes(track.id)) { state.setPlaying(false); return; }
    let cancelled = false;
    const sourceTask = (repository as unknown as { playbackSource?: (trackId: string) => Promise<string> }).playbackSource?.(track.id) ?? Promise.resolve(track.audioUrl);
    sourceTask.then((nextSource) => {
      if (cancelled) return;
      element.src = nextSource;
      setSource(nextSource);
      if (state.isPlaying) element.play().catch((error: DOMException) => {
        if (error.name === "NotAllowedError") state.setGestureRequired(true); else handleFailure(track.id);
      });
    }).catch(() => handleFailure(track.id));
    return () => { cancelled = true; };
    // Source changes intentionally trigger playback synchronization only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track?.id]);

  useEffect(() => {
    const element = audio.current; if (!element || !track) return;
    if (!source) return;
    if (state.isPlaying) element.play().catch((error: DOMException) => {
      if (error.name === "NotAllowedError") state.setGestureRequired(true); else handleFailure(track.id);
    }); else element.pause();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isPlaying, source]);

  if (!track) return <audio ref={audio} />;
  return <audio
    ref={audio}
    src={source || undefined}
    preload="metadata"
    onLoadedMetadata={(event) => state.setProgress(event.currentTarget.currentTime, event.currentTarget.duration || track.durationSeconds)}
    onTimeUpdate={(event) => {
      const element = event.currentTarget; state.setProgress(element.currentTime, element.duration || track.durationSeconds);
      const threshold = Math.min(30, (element.duration || track.durationSeconds) * 0.8);
      if (element.currentTime >= threshold && counted.current !== track.id && track.isPlayableForViewer) { counted.current = track.id; const progress = (repository as unknown as { recordPlaybackProgress?: (trackId: string, positionSeconds: number) => void }).recordPlaybackProgress; if (progress) progress(track.id, element.currentTime); else repository.recordValidStream(track.id); }
    }}
    onEnded={(event) => { if (state.repeatMode === "one") { event.currentTarget.currentTime = 0; state.setProgress(0); event.currentTarget.play().catch((error: DOMException) => { if (error.name === "NotAllowedError") state.setGestureRequired(true); else handleFailure(track.id); }); } else state.next("ended"); }}
    onError={() => { if (source) handleFailure(track.id); }}
    onWaiting={() => { if (stallTimer.current) clearTimeout(stallTimer.current); stallTimer.current = window.setTimeout(() => { const element = audio.current; if (!element || element.readyState < 3) handleFailure(track.id); else element.play().catch(() => handleFailure(track.id)); }, 2000); }}
    onPlaying={() => { if (stallTimer.current) clearTimeout(stallTimer.current); stallTimer.current = null; state.resetFailures(); }}
  />;
}

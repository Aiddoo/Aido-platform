import type { AudioPartPlaylistStatus } from '@src/core/ports/audio-part-playlist';
import { SECOND_MS } from '@src/shared/constants/time-units';

import type {
  VoiceNotePlayback,
  VoiceNotePlaybackMemory,
} from '../domains/voice-note-playback.model';

/** 조각 안의 위치를 노트 전체의 시계로 바꾼다 */
export function toVoiceNotePlayback(
  status: Omit<AudioPartPlaylistStatus, 'didJustFinish'>,
  parts: readonly { startMs: number }[],
  memory: VoiceNotePlaybackMemory,
): { playback: VoiceNotePlayback; memory: VoiceNotePlaybackMemory } {
  const lastIndex = parts.length - 1;
  const resolvedDurationMs =
    status.currentIndex === lastIndex
      ? Math.max(
          memory.resolvedDurationMs,
          (parts[lastIndex]?.startMs ?? 0) + Math.round(status.duration * SECOND_MS),
        )
      : memory.resolvedDurationMs;
  const partStartMs = parts[status.currentIndex]?.startMs ?? 0;

  return {
    memory: { ...memory, resolvedDurationMs },
    playback: {
      isLoaded: memory.hasFinished || status.isLoaded,
      isPlaying: !memory.hasFinished && status.isPlaying,
      positionMs: memory.hasFinished
        ? resolvedDurationMs
        : Math.min(partStartMs + Math.round(status.currentTime * SECOND_MS), resolvedDurationMs),
      durationMs: resolvedDurationMs,
    },
  };
}

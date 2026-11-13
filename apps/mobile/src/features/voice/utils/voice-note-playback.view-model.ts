import type { AudioPartPlaylistStatus } from '@src/core/ports/audio-part-playlist';
import { SECOND_MS } from '@src/shared/constants/time-units';
import { clamp } from 'es-toolkit';

import { findRecordingIndexAt } from '../domains/voice-note.model';

export interface VoiceNotePlayback {
  isLoaded: boolean;
  isPlaying: boolean;
  positionMs: number;
  durationMs: number;
}

export interface VoiceNotePlaybackMemory {
  /** 마지막 조각까지 다 들었다. iOS는 이때 현재 항목이 사라져 시간·길이가 0이 되므로 따로 기억한다 */
  hasFinished: boolean;
  /** 저장된 길이와 마지막 조각의 실제 길이 중 긴 쪽 */
  resolvedDurationMs: number;
}

/** 조각 안의 위치를 노트 전체의 시계로 바꾼다 */
export function getVoiceNotePlayback(
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

/** 노트 시계의 위치가 어느 조각의 몇 초인지 찾는다. 조각이 없으면 null이다 */
export function findPartSeek(
  parts: readonly { startMs: number }[],
  targetMs: number,
  durationMs: number,
): { index: number; offsetSeconds: number } | null {
  const index = findRecordingIndexAt(parts, targetMs);
  const part = parts[index];
  if (part == null) {
    return null;
  }
  return {
    index,
    offsetSeconds: Math.max(0, clamp(targetMs, 0, durationMs) - part.startMs) / SECOND_MS,
  };
}

import { SECOND_MS } from '@src/shared/constants/time-units';
import { clamp } from 'es-toolkit';
import { z } from 'zod';

// 녹음 조각을 이어 들을 때 노트 전체의 시계로 본 재생 상태
const voiceNotePlaybackSchema = z.object({
  isLoaded: z.boolean(),
  isPlaying: z.boolean(),
  positionMs: z.int().nonnegative(),
  durationMs: z.int().nonnegative(),
});
export type VoiceNotePlayback = z.infer<typeof voiceNotePlaybackSchema>;

const voiceNotePlaybackMemorySchema = z.object({
  // 마지막 조각까지 다 들었다. iOS는 이때 현재 항목이 사라져 시간·길이가 0이 되므로 따로 기억한다
  hasFinished: z.boolean(),
  // 저장된 길이와 마지막 조각의 실제 길이 중 긴 쪽
  resolvedDurationMs: z.int().nonnegative(),
});
export type VoiceNotePlaybackMemory = z.infer<typeof voiceNotePlaybackMemorySchema>;

/** 재생 조각(노트 시계의 시작 위치)에서 이 위치가 속한 조각. 첫 조각 앞이면 첫 조각이다 */
export function getRecordingIndexAt(
  recordings: readonly { startMs: number }[],
  positionMs: number,
): number {
  return Math.max(
    0,
    recordings.findLastIndex((recording) => recording.startMs <= positionMs),
  );
}

/** 노트 시계의 위치가 어느 조각의 몇 초인지 찾는다. 조각이 없으면 null이다 */
export function findPartSeek(
  parts: readonly { startMs: number }[],
  targetMs: number,
  durationMs: number,
): { index: number; offsetSeconds: number } | null {
  const index = getRecordingIndexAt(parts, targetMs);
  const part = parts[index];
  if (part == null) {
    return null;
  }
  return {
    index,
    offsetSeconds: Math.max(0, clamp(targetMs, 0, durationMs) - part.startMs) / SECOND_MS,
  };
}

import { SPEECH_LEVEL_THRESHOLD, WAVEFORM_BAR } from '../../constants/voice-note.constants';
import type { VoiceNoteSentence } from '../../domains/voice-note.model';

const QUIET_LEVEL = 0.06;
const SPEECH_BASE_LEVEL = 0.35;
const SPEECH_SWING = 0.55;
const SPEECH_RIPPLE = { primary: 0.9, secondary: 0.37 } as const;

export interface TimelineBar {
  index: number;
  /** 0..1. 아직 소리가 없는 자리(미래·시작 전)는 null */
  level: number | null;
  isSpeech: boolean;
}

function getBarCount(durationMs: number) {
  return Math.max(0, Math.ceil(durationMs / WAVEFORM_BAR.intervalMs));
}

/**
 * 다시 듣기 파형은 말한 구간만 알면 되므로 문장 구간에서 만든다.
 * 말한 칸은 같은 입력에 같은 높이가 나오는 완만한 물결로, 조용한 칸은 낮게 둔다.
 */
export function createSpeechLevels(
  sentences: readonly VoiceNoteSentence[],
  durationMs: number,
): number[] {
  const barCount = getBarCount(durationMs);
  const speechBars = new Set<number>();
  for (const { startMs, endMs } of sentences) {
    const lastBar = Math.min(barCount, Math.ceil(endMs / WAVEFORM_BAR.intervalMs));
    for (let bar = Math.ceil(startMs / WAVEFORM_BAR.intervalMs); bar < lastBar; bar += 1) {
      speechBars.add(bar);
    }
  }

  return Array.from({ length: barCount }, (_, index) => {
    if (!speechBars.has(index)) {
      return QUIET_LEVEL;
    }
    const ripple = Math.abs(
      Math.sin(index * SPEECH_RIPPLE.primary) * Math.cos(index * SPEECH_RIPPLE.secondary),
    );
    return SPEECH_BASE_LEVEL + SPEECH_SWING * ripple;
  });
}

/** 녹음 중 음량을 파형 칸으로 모은다. 이벤트 간격의 절반 칸이라 두 번에 한 칸을 만든다 */
const SAMPLES_PER_BAR = 2;

export interface LevelSampler {
  levels: readonly number[];
  /** 아직 칸이 되지 않은 음량 중 가장 큰 값과 개수 */
  pendingMax: number;
  pendingCount: number;
}

export function createLevelSampler(): LevelSampler {
  return { levels: [], pendingMax: 0, pendingCount: 0 };
}

export function appendLevelSample(sampler: LevelSampler, level: number): LevelSampler {
  const pendingMax = Math.max(sampler.pendingMax, level);
  const pendingCount = sampler.pendingCount + 1;
  return pendingCount >= SAMPLES_PER_BAR
    ? { levels: [...sampler.levels, pendingMax], pendingMax: 0, pendingCount: 0 }
    : { ...sampler, pendingMax, pendingCount };
}

export function getFlagBarIndexes(sentences: readonly VoiceNoteSentence[]): number[] {
  return sentences
    .filter((sentence) => sentence.isBookmarked)
    .map((sentence) => Math.floor(sentence.startMs / WAVEFORM_BAR.intervalMs));
}

export function getBarIndexAt(positionMs: number): number {
  return Math.max(0, Math.floor(positionMs / WAVEFORM_BAR.intervalMs));
}

/** 재생선(가운데)을 기준으로 왼쪽 과거와 오른쪽 미래 `sideCount`칸씩, 모두 `2 * sideCount + 1`칸이다 */
export function getTimelineWindow(
  levels: readonly number[],
  cursorIndex: number,
  sideCount: number,
): TimelineBar[] {
  return Array.from({ length: sideCount * 2 + 1 }, (_, slot) => {
    const index = cursorIndex - sideCount + slot;
    const level = index >= 0 ? (levels[index] ?? null) : null;

    return { index, level, isSpeech: level != null && level >= SPEECH_LEVEL_THRESHOLD };
  });
}

/** 전체 길이를 `count`칸으로 줄여 스크러버에 맞춘다. 칸마다 구간의 가장 큰 값이다 */
export function resampleLevels(levels: readonly number[], count: number): number[] {
  if (count <= 0 || levels.length === 0) {
    return [];
  }
  const size = levels.length / count;

  return Array.from({ length: count }, (_, slot) => {
    const from = Math.floor(slot * size);
    const to = Math.max(from + 1, Math.floor((slot + 1) * size));
    return Math.max(...levels.slice(from, to));
  });
}

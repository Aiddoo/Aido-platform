import { range } from 'es-toolkit';

import { WAVEFORM_BAR } from '../constants/voice-note.constants';
import type { VoiceNoteSentence } from '../domains/voice-note.model';

const QUIET_LEVEL = 0.06;
const SPEECH_BASE_LEVEL = 0.35;
const SPEECH_SWING = 0.55;
const SPEECH_RIPPLE = { primary: 0.9, secondary: 0.37 } as const;

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

  return range(barCount).map((index) => {
    if (!speechBars.has(index)) {
      return QUIET_LEVEL;
    }
    const ripple = Math.abs(
      Math.sin(index * SPEECH_RIPPLE.primary) * Math.cos(index * SPEECH_RIPPLE.secondary),
    );
    return SPEECH_BASE_LEVEL + SPEECH_SWING * ripple;
  });
}

export interface LevelSampler {
  pendingMax: number;
  elapsedMs: number;
}

export function createLevelSampler(): LevelSampler {
  'worklet';
  return { pendingMax: 0, elapsedMs: 0 };
}

/**
 * 프레임마다 음량을 모아 `intervalMs`마다 그동안의 최댓값으로 한 칸을 만든다. UI 스레드에서 부른다.
 * worklet의 매개변수 기본값은 Reanimated가 모듈 값을 잡아 주지 않아 UI 스레드에서 오류가 나므로 호출부가 넘긴다.
 */
// 프레임마다 도는 worklet이라 위치 인자를 유지한다
export function appendLevelFrame(
  sampler: LevelSampler,
  level: number,
  frameMs: number,
  intervalMs: number,
): { sampler: LevelSampler; bar: number | null } {
  'worklet';
  const pendingMax = Math.max(sampler.pendingMax, level);
  const elapsedMs = sampler.elapsedMs + frameMs;
  return elapsedMs >= intervalMs
    ? { sampler: { pendingMax: 0, elapsedMs: elapsedMs % intervalMs }, bar: pendingMax }
    : { sampler: { pendingMax, elapsedMs }, bar: null };
}

export function appendTimelineBar(
  bars: readonly number[],
  bar: number,
  maxBars: number,
): readonly number[] {
  'worklet';
  return bars.length < maxBars ? [...bars, bar] : [...bars.slice(1), bar];
}

export function getFlagBarIndexes(sentences: readonly VoiceNoteSentence[]): number[] {
  return sentences
    .filter((sentence) => sentence.isBookmarked)
    .map((sentence) => Math.floor(sentence.startMs / WAVEFORM_BAR.intervalMs));
}

/**
 * 아직 칸이 없는 중요 표시에 지금 칸 번호를 매긴다. 녹음 중 칸은 듣는 동안에만 쌓여(이어 듣기는 0칸에서 시작한다)
 * 시간으로 계산하면 아직 없는 칸을 가리켜 깃발이 그려지지 않는다.
 */
export function withFlagBars(
  flagBars: ReadonlyMap<number, number>,
  bookmarksMs: readonly number[],
  currentBarIndex: number,
): ReadonlyMap<number, number> {
  const isUnchanged =
    bookmarksMs.length === flagBars.size && bookmarksMs.every((ms) => flagBars.has(ms));
  if (isUnchanged) {
    return flagBars;
  }
  return new Map(
    bookmarksMs.map((ms) => [ms, flagBars.get(ms) ?? Math.max(0, currentBarIndex)] as const),
  );
}

/**
 * 재생선(가운데)을 기준으로 왼쪽 과거와 오른쪽 미래 `sideCount`칸씩 모두 `2 * sideCount + 1`칸 중 `slot`칸의 소리 크기.
 * 재생선은 `levels`의 마지막 칸을 가리키고, 아직 소리가 없는 자리는 null이다. UI 스레드에서 프레임마다 부른다.
 */
export function getTimelineLevel(
  levels: readonly number[],
  slot: number,
  sideCount: number,
): number | null {
  'worklet';
  const index = levels.length - 1 - sideCount + slot;
  return index >= 0 ? (levels[index] ?? null) : null;
}

// 프레임마다 도는 worklet이라 위치 인자를 유지한다
export function followLevel(
  current: number,
  target: number,
  elapsedMs: number,
  { attackMs, releaseMs }: { attackMs: number; releaseMs: number },
): number {
  'worklet';
  const followMs = target > current ? attackMs : releaseMs;
  return current + (target - current) * (1 - Math.exp(-elapsedMs / followMs));
}

/** 재생 비율까지 칠할 칸 수. 칸이 바뀔 때만 경로를 다시 만들려고 UI 스레드에서 먼저 센다 */
export function getPlayedBarCount(ratio: number, barCount: number): number {
  'worklet';
  return Math.ceil(ratio * barCount);
}

export function resampleLevels(levels: readonly number[], count: number): number[] {
  if (count <= 0 || levels.length === 0) {
    return [];
  }
  const size = levels.length / count;

  return range(count).map((slot) => {
    const from = Math.floor(slot * size);
    const to = Math.max(from + 1, Math.floor((slot + 1) * size));
    return Math.max(...levels.slice(from, to));
  });
}

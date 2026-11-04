import { createVoiceNoteSentence } from '../../__tests__/voice-note.factories';
import {
  appendLevelSample,
  createLevelSampler,
  createSpeechLevels,
  getFlagBarIndexes,
  getTimelineWindow,
  resampleLevels,
} from './waveform.view-model';

describe('createSpeechLevels', () => {
  test('말한 구간은 높고 조용한 구간은 낮다', () => {
    // Given
    const sentences = [createVoiceNoteSentence({ startMs: 0, endMs: 500 })];

    // When
    const levels = createSpeechLevels(sentences, 1_000);

    // Then
    expect(levels).toHaveLength(10);
    expect(Math.min(...levels.slice(0, 5))).toBeGreaterThan(0.3);
    expect(levels.slice(5)).toEqual([0.06, 0.06, 0.06, 0.06, 0.06]);
  });
});

describe('getFlagBarIndexes', () => {
  test('중요 표시한 문장의 시작 칸에만 깃발을 꽂는다', () => {
    // Given
    const sentences = [
      createVoiceNoteSentence({ startMs: 41_050, isBookmarked: true }),
      createVoiceNoteSentence({ startMs: 90_000, isBookmarked: false }),
    ];

    // When
    const indexes = getFlagBarIndexes(sentences);

    // Then
    expect(indexes).toEqual([410]);
  });
});

describe('getTimelineWindow', () => {
  test('시작 앞과 아직 소리가 없는 뒤쪽 칸은 level이 null이다', () => {
    // Given
    const levels = [0.5, 0.6, 0.7];

    // When
    const bars = getTimelineWindow(levels, 1, 2);

    // Then
    expect(bars.map((bar) => bar.level)).toEqual([null, 0.5, 0.6, 0.7, null]);
    expect(bars.map((bar) => bar.index)).toEqual([-1, 0, 1, 2, 3]);
  });
});

describe('resampleLevels', () => {
  test('줄인 칸은 구간에서 가장 큰 값을 가진다', () => {
    // Given
    const levels = [0.1, 0.9, 0.2, 0.3];

    // When
    const result = resampleLevels(levels, 2);

    // Then
    expect(result).toEqual([0.9, 0.3]);
  });

  test('칸 수가 원본보다 많아도 비지 않는다', () => {
    // Given
    const levels = [0.4, 0.8];

    // When
    const result = resampleLevels(levels, 4);

    // Then
    expect(result).toEqual([0.4, 0.4, 0.8, 0.8]);
  });
});

describe('appendLevelSample', () => {
  test('음량 두 번을 파형 한 칸으로 모으고 큰 값을 남긴다', () => {
    // Given
    const sampler = createLevelSampler();

    // When
    const next = appendLevelSample(appendLevelSample(sampler, 0.2), 0.7);

    // Then
    expect(next.levels).toEqual([0.7]);
  });
});

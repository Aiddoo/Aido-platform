import { createVoiceNoteSentence } from '../../__tests__/voice-note.factories';
import {
  appendLevelSample,
  appendTimelineBar,
  createLevelSampler,
  createSpeechLevels,
  getFlagBarIndexes,
  getTimelineLevel,
  resampleLevels,
  withFlagBars,
} from './waveform.view-model';

describe('withFlagBars', () => {
  test('음량 이벤트가 느려 칸이 시간보다 적어도 표시한 순간의 칸에 깃발을 꽂는다', () => {
    // Given 13초가 지났지만 칸은 40개다
    const bookmarkMs = 13_000;

    // When
    const flagBars = withFlagBars(new Map(), [bookmarkMs], 39);

    // Then
    expect(flagBars.get(bookmarkMs)).toBe(39);
  });

  test('이미 꽂은 깃발은 칸이 늘어도 자리를 옮기지 않는다', () => {
    // Given
    const flagBars = new Map([[1_000, 10]]);

    // When
    const next = withFlagBars(flagBars, [1_000, 2_000], 30);

    // Then
    expect(next.get(1_000)).toBe(10);
    expect(next.get(2_000)).toBe(30);
  });

  test('표시를 지우면 깃발도 지운다', () => {
    // When
    const next = withFlagBars(new Map([[1_000, 10]]), [], 30);

    // Then
    expect(next.size).toBe(0);
  });

  test('바뀐 게 없으면 같은 값을 돌려줘 다시 그리지 않는다', () => {
    // Given
    const flagBars = new Map([[1_000, 10]]);

    // When
    const next = withFlagBars(flagBars, [1_000], 30);

    // Then
    expect(next).toBe(flagBars);
  });

  test('칸이 아직 없으면 0번 칸에 꽂는다', () => {
    // When
    const next = withFlagBars(new Map(), [500], -1);

    // Then
    expect(next.get(500)).toBe(0);
  });
});

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

describe('getTimelineLevel', () => {
  test('재생선은 마지막 칸을 가리키고 시작 앞과 아직 소리가 없는 뒤쪽 칸은 null이다', () => {
    // Given
    const levels = [0.5, 0.6, 0.7];

    // When
    const window = [0, 1, 2, 3, 4, 5, 6].map((slot) => getTimelineLevel(levels, slot, 3));

    // Then
    expect(window).toEqual([null, 0.5, 0.6, 0.7, null, null, null]);
  });
});

describe('appendTimelineBar', () => {
  test('오래 녹음해도 칸 수는 정한 길이를 넘지 않고 최근 칸을 남긴다', () => {
    // Given
    const bars = Array.from({ length: 18_000 }, (_, index) => index).reduce<readonly number[]>(
      (current, bar) => appendTimelineBar(current, bar, 160),
      [],
    );

    // Then
    expect(bars).toHaveLength(160);
    expect(bars.at(-1)).toBe(17_999);
    expect(bars[0]).toBe(17_840);
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
    const first = appendLevelSample(sampler, 0.2);
    const second = appendLevelSample(first.sampler, 0.7);

    // Then
    expect(first.bar).toBeNull();
    expect(second.bar).toBe(0.7);
  });
});

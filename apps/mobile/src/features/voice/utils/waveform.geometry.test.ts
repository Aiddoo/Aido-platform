import { range } from 'es-toolkit';

import { createVoiceNoteSentence } from '../__tests__/voice-note.fixtures';
import {
  appendLevelFrame,
  appendTimelineBar,
  createLevelSampler,
  createSpeechLevels,
  getFlagBarIndexes,
  getPlayedBarCount,
  getTimelineLevel,
  resampleLevels,
  withFlagBars,
} from './waveform.geometry';

describe('withFlagBars', () => {
  it('음량 이벤트가 느려 칸이 시간보다 적어도 표시한 순간의 칸에 깃발을 꽂는다', () => {
    // Given
    // 13초가 지났지만 칸은 40개다
    const bookmarkMs = 13_000;

    // When
    const flagBars = withFlagBars(new Map(), [bookmarkMs], 39);

    // Then
    expect(flagBars.get(bookmarkMs)).toBe(39);
  });

  it('이미 꽂은 깃발은 칸이 늘어도 자리를 옮기지 않는다', () => {
    // Given
    const flagBars = new Map([[1_000, 10]]);

    // When
    const next = withFlagBars(flagBars, [1_000, 2_000], 30);

    // Then
    expect(next.get(1_000)).toBe(10);
    expect(next.get(2_000)).toBe(30);
  });

  it('표시를 지우면 깃발도 지운다', () => {
    // When
    const next = withFlagBars(new Map([[1_000, 10]]), [], 30);

    // Then
    expect(next.size).toBe(0);
  });

  it('바뀐 게 없으면 같은 값을 돌려줘 다시 그리지 않는다', () => {
    // Given
    const flagBars = new Map([[1_000, 10]]);

    // When
    const next = withFlagBars(flagBars, [1_000], 30);

    // Then
    expect(next).toBe(flagBars);
  });

  it('칸이 아직 없으면 0번 칸에 꽂는다', () => {
    // When
    const next = withFlagBars(new Map(), [500], -1);

    // Then
    expect(next.get(500)).toBe(0);
  });
});

describe('createSpeechLevels', () => {
  it('말한 구간은 높고 조용한 구간은 낮다', () => {
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
  it('중요 표시한 문장의 시작 칸에만 깃발을 꽂는다', () => {
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
  it('재생선은 마지막 칸을 가리키고 시작 앞과 아직 소리가 없는 뒤쪽 칸은 null이다', () => {
    // Given
    const levels = [0.5, 0.6, 0.7];

    // When
    const window = [0, 1, 2, 3, 4, 5, 6].map((slot) => getTimelineLevel(levels, slot, 3));

    // Then
    expect(window).toEqual([null, 0.5, 0.6, 0.7, null, null, null]);
  });
});

describe('appendTimelineBar', () => {
  it('오래 녹음해도 칸 수는 정한 길이를 넘지 않고 최근 칸을 남긴다', () => {
    // Given
    const bars = range(18_000)
      .map((index) => index)
      .reduce<readonly number[]>((current, bar) => appendTimelineBar(current, bar, 160), []);

    // Then
    expect(bars).toHaveLength(160);
    expect(bars.at(-1)).toBe(17_999);
    expect(bars[0]).toBe(17_840);
  });
});

describe('resampleLevels', () => {
  it('줄인 칸은 구간에서 가장 큰 값을 가진다', () => {
    // Given
    const levels = [0.1, 0.9, 0.2, 0.3];

    // When
    const result = resampleLevels(levels, 2);

    // Then
    expect(result).toEqual([0.9, 0.3]);
  });

  it('칸 수가 원본보다 많아도 비지 않는다', () => {
    // Given
    const levels = [0.4, 0.8];

    // When
    const result = resampleLevels(levels, 4);

    // Then
    expect(result).toEqual([0.4, 0.4, 0.8, 0.8]);
  });
});

describe('appendLevelFrame', () => {
  it('칸 간격이 차기 전에는 최댓값만 모으고 칸을 만들지 않는다', () => {
    // When
    const { sampler, bar } = appendLevelFrame(createLevelSampler(), 0.5, 16, 100);

    // Then
    expect(bar).toBeNull();
    expect(sampler).toEqual({ pendingMax: 0.5, elapsedMs: 16 });
  });

  it('칸 간격이 차면 그동안의 최댓값으로 한 칸을 만들고 남은 시간을 넘긴다', () => {
    // Given
    const pending = { pendingMax: 0.8, elapsedMs: 90 };

    // When
    const { sampler, bar } = appendLevelFrame(pending, 0.2, 16, 100);

    // Then
    expect(bar).toBe(0.8);
    expect(sampler).toEqual({ pendingMax: 0, elapsedMs: 6 });
  });

  it('음량이 0으로 내려가도 시간이 지나면 조용한 칸을 만든다', () => {
    // Given
    const pending = { pendingMax: 0, elapsedMs: 95 };

    // When
    const { bar } = appendLevelFrame(pending, 0, 16, 100);

    // Then
    expect(bar).toBe(0);
  });

  it('프레임이 크게 벌어져도 칸을 한 번에 하나만 만든다', () => {
    // When
    const { sampler, bar } = appendLevelFrame(createLevelSampler(), 0.4, 950, 100);

    // Then
    expect(bar).toBe(0.4);
    expect(sampler.elapsedMs).toBe(50);
  });
});

describe('getPlayedBarCount', () => {
  it.each([
    { ratio: 0, expected: 0 },
    { ratio: 0.25, expected: 25 },
    { ratio: 0.251, expected: 26 },
    { ratio: 1, expected: 100 },
  ])('$ratio이면 100칸 중 $expected칸을 칠한다', ({ ratio, expected }) => {
    // When
    const count = getPlayedBarCount(ratio, 100);

    // Then
    expect(count).toBe(expected);
  });
});

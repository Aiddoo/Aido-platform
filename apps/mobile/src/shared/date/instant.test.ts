import { ZodError } from 'zod';

import { diffMs, getMinutesUntil, hasInstantPassed, toEpochMs, toInstant } from './instant';

describe('toInstant', () => {
  it.each([
    ['Z 표기', '2026-10-02T00:00:00.000Z'],
    ['초만 있는 Z 표기', '2026-10-03T00:00:00Z'],
    ['오프셋 표기', '2026-10-02T09:00:00+09:00'],
  ])('%s는 받아들여 문자열 그대로 둔다', (_name, iso) => {
    // When
    const result = toInstant(iso);

    // Then
    expect(result).toBe(iso);
  });

  it.each(['', '2026-10-02', '어제', '2026-13-01T00:00:00Z', '2026-10-02T00:00:00'])(
    '순간이 아닌 값 %j는 거부한다',
    (value) => {
      // When
      const action = () => toInstant(value);

      // Then
      expect(action).toThrow(ZodError);
    },
  );
});

describe('toEpochMs — 초안 sourceUpdatedAt 호환', () => {
  it('Date의 getTime과 같은 숫자를 돌려준다', () => {
    // Given
    const iso = '2026-10-02T00:01:00.123Z';

    // When
    const result = toEpochMs(toInstant(iso));

    // Then
    expect(result).toBe(new Date(iso).getTime());
  });
});

describe('diffMs', () => {
  const seoulNine = toInstant('2026-10-02T09:00:00+09:00');
  const utcFive = toInstant('2026-10-02T05:00:00Z');

  it('문자열 사전순과 다른 순서도 순간으로 판단한다', () => {
    // Given
    const isLexicallyLater = seoulNine > utcFive;

    // When
    const difference = diffMs(seoulNine, utcFive);

    // Then
    // 사전순으로는 서울 표기가 뒤지만 실제로는 UTC 5시보다 5시간 빠르다
    expect(isLexicallyLater).toBe(true);
    expect(difference).toBe(-5 * 60 * 60 * 1000);
  });

  it('같은 순간은 오프셋이 달라도 차이가 0이다', () => {
    // Given
    const utc = toInstant('2026-10-02T00:00:00Z');
    const seoulNineAm = toInstant('2026-10-02T09:00:00+09:00');

    // When
    const difference = diffMs(seoulNineAm, utc);

    // Then
    expect(difference).toBe(0);
  });

  it('차이는 앞 값에서 뒤 값을 뺀 밀리초다', () => {
    // When
    const difference = diffMs(utcFive, seoulNine);

    // Then
    expect(difference).toBe(5 * 60 * 60 * 1000);
  });
});

describe('hasInstantPassed', () => {
  it('지금과 같은 순간이면 true를 반환한다', () => {
    // Given
    const instant = toInstant('2026-10-25T00:00:00Z');
    const now = toInstant('2026-10-25T09:00:00+09:00');

    // When
    const result = hasInstantPassed(instant, now);

    // Then
    // 오프셋이 달라도 같은 순간이라 끝나는 시각 자체를 지난 것으로 본다
    expect(result).toBe(true);
  });

  it('1ms 남았으면 false를 반환한다', () => {
    // Given
    const instant = toInstant('2026-10-25T00:00:00.001Z');
    const now = toInstant('2026-10-25T00:00:00.000Z');

    // When
    const result = hasInstantPassed(instant, now);

    // Then
    expect(result).toBe(false);
  });
});

describe('getMinutesUntil', () => {
  const now = toInstant('2026-11-02T06:26:00.000Z');

  it('목표까지 남은 분을 돌려준다', () => {
    // Given
    const target = toInstant('2026-11-02T06:43:00.000Z');

    // When
    const minutes = getMinutesUntil(target, now);

    // Then
    // 06:43 - 06:26 = 17분
    expect(minutes).toBe(17);
  });

  it('1분이 안 남아도 1분으로 올린다', () => {
    // Given
    const target = toInstant('2026-11-02T06:26:00.001Z');

    // When
    const minutes = getMinutesUntil(target, now);

    // Then
    // 1ms / 60,000ms → 올림 1분
    expect(minutes).toBe(1);
  });

  it('목표가 지금이면 0분이다', () => {
    // When
    const minutes = getMinutesUntil(now, now);

    // Then
    expect(minutes).toBe(0);
  });

  it('목표가 이미 지났으면 음수가 아니라 0분이다', () => {
    // Given
    const target = toInstant('2026-11-02T06:20:00.000Z');

    // When
    const minutes = getMinutesUntil(target, now);

    // Then
    expect(minutes).toBe(0);
  });
});

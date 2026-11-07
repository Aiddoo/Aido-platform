import {
  diffMs,
  fromDate,
  fromWallClock,
  getNowInstant,
  getZonedHour,
  hasSameWallClock,
  toDateKey,
  toEpochMs,
  toHHmm,
  toInstant,
} from './instant';

describe('toDateKey', () => {
  it.each([
    ['서울 자정 직전', '2026-10-01T14:59:59.999Z', '2026-10-01', '2026-10-01'],
    ['서울 자정 정각', '2026-10-01T15:00:00.000Z', '2026-10-02', '2026-10-01'],
    ['LA 자정 정각', '2026-10-02T07:00:00.000Z', '2026-10-02', '2026-10-02'],
  ])('%s에는 같은 시각이어도 서울과 LA의 날짜가 다르다', (_name, iso, seoulKey, losAngelesKey) => {
    // Given
    const instant = new Date(iso);

    // When
    const seoul = toDateKey(instant, 'Asia/Seoul');
    const losAngeles = toDateKey(instant, 'America/Los_Angeles');

    // Then
    expect(seoul).toBe(seoulKey);
    expect(losAngeles).toBe(losAngelesKey);
  });

  it('윤일 경계에서 서울은 3월 1일, LA는 2월 29일이다', () => {
    // Given
    const instant = new Date('2028-02-29T15:00:00.000Z');

    // When
    const seoul = toDateKey(instant, 'Asia/Seoul');
    const losAngeles = toDateKey(instant, 'America/Los_Angeles');

    // Then
    expect(seoul).toBe('2028-03-01');
    expect(losAngeles).toBe('2028-02-29');
  });

  it('유효하지 않은 Date는 빈 문자열을 반환한다', () => {
    // Given
    const invalid = new Date(Number.NaN);

    // When
    const result = toDateKey(invalid, 'Asia/Seoul');

    // Then
    expect(result).toBe('');
  });
});

describe('getZonedHour', () => {
  it('지정 시간대의 0-23시를 반환한다', () => {
    // When
    const midnightHour = getZonedHour(new Date('2026-10-01T15:30:00Z'), 'Asia/Seoul');
    const lateNightHour = getZonedHour(new Date('2026-10-01T14:30:00Z'), 'Asia/Seoul');

    // Then
    expect(midnightHour).toBe(0);
    expect(lateNightHour).toBe(23);
  });
});

describe('toHHmm — 시간대 기준 HH:mm', () => {
  it('같은 순간을 서울과 LA의 24시간제 HH:mm으로 읽는다', () => {
    // Given
    const instant = new Date('2028-02-29T15:05:00Z');

    // When
    const seoul = toHHmm(instant, 'Asia/Seoul');
    const losAngeles = toHHmm(instant, 'America/Los_Angeles');

    // Then
    expect(seoul).toBe('00:05');
    expect(losAngeles).toBe('07:05');
  });
});

describe('hasSameWallClock', () => {
  const instant = new Date('2026-10-01T06:20:00Z');

  it('이름이 달라도 오프셋이 같은 시간대는 같은 벽시계로 본다', () => {
    // When
    const result = hasSameWallClock(instant, 'Asia/Seoul', 'Asia/Tokyo');

    // Then
    expect(result).toBe(true);
  });

  it('30분 차이도 다른 벽시계로 본다', () => {
    // When
    const result = hasSameWallClock(instant, 'Asia/Kolkata', 'Asia/Karachi');

    // Then
    expect(result).toBe(false);
  });

  it('서머타임으로 오프셋이 갈리는 날은 그날의 오프셋으로 판단한다', () => {
    // Given
    const beforeFallBack = new Date('2026-10-31T20:00:00Z');
    const afterFallBack = new Date('2026-11-02T20:00:00Z');

    // When
    const before = hasSameWallClock(beforeFallBack, 'America/Los_Angeles', 'America/Phoenix');
    const after = hasSameWallClock(afterFallBack, 'America/Los_Angeles', 'America/Phoenix');

    // Then
    // 서머타임 동안(-7)만 같고 해제 뒤(-8 대 -7)에는 다르다
    expect(before).toBe(true);
    expect(after).toBe(false);
  });
});

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
      expect(action).toThrow();
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

describe('Instant를 시간대로 읽기', () => {
  it('자정 직전·정각이 서울에서 다른 날짜가 된다', () => {
    // When
    const beforeMidnight = toDateKey(toInstant('2026-10-01T14:59:59.999Z'), 'Asia/Seoul');
    const atMidnight = toDateKey(toInstant('2026-10-01T15:00:00.000Z'), 'Asia/Seoul');

    // Then
    expect(beforeMidnight).toBe('2026-10-01');
    expect(atMidnight).toBe('2026-10-02');
  });

  it('오프셋 표기도 같은 순간이면 같은 날짜와 시각으로 읽는다', () => {
    // Given
    // 서울 자정은 UTC 전날 15시
    const seoulMidnight = toInstant('2026-10-02T00:00:00+09:00');

    // When
    const seoulKey = toDateKey(seoulMidnight, 'Asia/Seoul');
    const losAngelesKey = toDateKey(seoulMidnight, 'America/Los_Angeles');
    const losAngelesTime = toHHmm(seoulMidnight, 'America/Los_Angeles');

    // Then
    expect(seoulKey).toBe('2026-10-02');
    expect(losAngelesKey).toBe('2026-10-01');
    expect(losAngelesTime).toBe('08:00');
  });

  it('LA 서머타임 시작 때 01:59 다음이 03:00이다', () => {
    // When
    const before = toHHmm(toInstant('2026-03-08T09:59:59Z'), 'America/Los_Angeles');
    const after = toHHmm(toInstant('2026-03-08T10:00:00Z'), 'America/Los_Angeles');

    // Then
    expect(before).toBe('01:59');
    expect(after).toBe('03:00');
  });

  it('LA 서머타임 해제 때 01시가 두 번 지나가도 날짜는 그대로다', () => {
    // Given
    const first = toInstant('2026-11-01T08:30:00Z');
    const second = toInstant('2026-11-01T09:30:00Z');

    // When
    const firstTime = toHHmm(first, 'America/Los_Angeles');
    const secondTime = toHHmm(second, 'America/Los_Angeles');
    const firstKey = toDateKey(first, 'America/Los_Angeles');
    const secondKey = toDateKey(second, 'America/Los_Angeles');

    // Then
    expect(firstTime).toBe('01:30');
    expect(secondTime).toBe('01:30');
    expect(firstKey).toBe('2026-11-01');
    expect(secondKey).toBe('2026-11-01');
  });
});

describe('fromDate', () => {
  it('Date를 같은 순간의 Instant로 바꾸고 다시 Date로 읽어도 같다', () => {
    // Given
    const date = new Date(2026, 10, 7, 23, 30);

    // When
    const instant = fromDate(date);

    // Then
    expect(toEpochMs(instant)).toBe(date.getTime());
  });

  it('자정 직전과 정각이 시간대에 따라 다른 날짜로 읽힌다', () => {
    // Given
    const beforeMidnight = fromDate(new Date('2026-10-01T14:59:59.999Z'));
    const atMidnight = fromDate(new Date('2026-10-01T15:00:00.000Z'));

    // When
    const beforeKey = toDateKey(beforeMidnight, 'Asia/Seoul');
    const atKey = toDateKey(atMidnight, 'Asia/Seoul');

    // Then
    expect(beforeKey).toBe('2026-10-01');
    expect(atKey).toBe('2026-10-02');
  });
});

describe('getNowInstant', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('고정한 시계의 지금을 밀리초까지 같은 순간으로 돌려준다', () => {
    // Given
    jest.useFakeTimers({ now: new Date('2026-10-01T14:59:59.999Z') });

    // When
    const now = getNowInstant();

    // Then
    expect(now).toBe('2026-10-01T14:59:59.999Z');
    expect(toDateKey(now, 'Asia/Seoul')).toBe('2026-10-01');
  });

  it('서머타임이 끝나는 날 같은 벽시계 한 시간이 두 번 와도 서로 다른 순간이다', () => {
    // Given
    jest.useFakeTimers({ now: new Date('2026-11-01T08:30:00.000Z') });
    const first = getNowInstant();

    // When
    jest.setSystemTime(new Date('2026-11-01T09:30:00.000Z'));
    const second = getNowInstant();

    // Then
    expect(toHHmm(first, 'America/Los_Angeles')).toBe('01:30');
    expect(toHHmm(second, 'America/Los_Angeles')).toBe('01:30');
    expect(diffMs(second, first)).toBe(3_600_000);
  });
});

describe('fromWallClock', () => {
  it.each([
    ['서머타임 시작일 오후', '2026-03-08', '14:30', '2026-03-08T21:30:00.000Z'],
    ['서머타임 시작일 새벽', '2026-03-08', '00:30', '2026-03-08T08:30:00.000Z'],
    ['서머타임 끝나는 날 오후', '2026-11-01', '14:30', '2026-11-01T22:30:00.000Z'],
  ])('LA %s에도 벽시계 그대로의 순간이다', (_name, dateKey, hhmm, iso) => {
    // Given
    const timeZone = 'America/Los_Angeles';

    // When
    const instant = fromWallClock(dateKey, hhmm, timeZone);

    // Then
    expect(new Date(instant).toISOString()).toBe(iso);
  });

  it.each([
    ['Asia/Seoul', '2026-10-01T05:30:00.000Z'],
    ['America/Los_Angeles', '2026-10-01T21:30:00.000Z'],
  ])('같은 벽시계도 %s에서는 다른 순간이다', (timeZone, iso) => {
    // Given
    const dateKey = '2026-10-01';

    // When
    const instant = fromWallClock(dateKey, '14:30', timeZone);

    // Then
    expect(new Date(instant).toISOString()).toBe(iso);
  });
});

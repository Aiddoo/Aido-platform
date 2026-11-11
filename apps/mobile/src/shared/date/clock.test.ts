import {
  createLocalDateState,
  getNextLocalMidnight,
  getNowInstant,
  isSameLocalDateState,
  millisecondsUntilNextLocalMidnight,
} from './clock';
import { addDaysToDateKey } from './date-key';
import { diffMs, toInstant } from './instant';
import { toDateKey, toHHmm } from './zoned';

describe('로컬 날짜와 시간대 상태', () => {
  it('같은 시각도 명시한 시간대의 날짜로 계산한다', () => {
    // Given
    const now = toInstant('2026-10-03T16:00:00.000Z');

    // When
    const seoul = createLocalDateState(now, 'Asia/Seoul');
    const utc = createLocalDateState(now, 'UTC');

    // Then
    expect(seoul.currentLocalDateKey).toBe('2026-10-04');
    expect(utc.currentLocalDateKey).toBe('2026-10-03');
    expect([seoul.currentUtcOffsetMinutes, utc.currentUtcOffsetMinutes]).toEqual([540, 0]);
  });

  it('하루 안의 단순 시간 경과로 오늘 상태를 반복 갱신하지 않는다', () => {
    // Given
    const previous = createLocalDateState(toInstant('2026-10-04T00:00:00.000Z'), 'Asia/Seoul');
    const next = createLocalDateState(toInstant('2026-10-04T01:00:00.000Z'), 'Asia/Seoul');

    // When
    const isSame = isSameLocalDateState(previous, next);

    // Then
    expect(isSame).toBe(true);
  });

  it('같은 날짜와 UTC 오프셋이라도 시간대가 바뀌면 갱신한다', () => {
    // Given
    const now = toInstant('2026-10-04T00:00:00.000Z');
    const previous = createLocalDateState(now, 'Asia/Seoul');
    const next = createLocalDateState(now, 'Asia/Tokyo');

    // When
    const isSame = isSameLocalDateState(previous, next);

    // Then
    expect(isSame).toBe(false);
  });

  it('같은 시간대에서 서머타임 UTC 오프셋이 바뀌면 갱신한다', () => {
    // Given
    // 뉴욕 07:00Z에 EST(-300) → EDT(-240)
    const previous = createLocalDateState(
      toInstant('2026-03-08T06:00:00.000Z'),
      'America/New_York',
    );
    const next = createLocalDateState(toInstant('2026-03-08T16:00:00.000Z'), 'America/New_York');

    // When
    const isSame = isSameLocalDateState(previous, next);

    // Then
    expect(isSame).toBe(false);
  });
});

describe('다음 로컬 자정 계산', () => {
  const HOUR_MS = 60 * 60 * 1000;

  it('자정 100ms 전이면 기기 시간대의 자정 직후까지 한 번만 예약한다', () => {
    // Given
    const now = toInstant('2026-07-14T14:59:59.900Z');

    // When
    const delay = millisecondsUntilNextLocalMidnight(now, 'Asia/Seoul');

    // Then
    expect(delay).toBe(200);
  });

  it('같은 시각이라도 시간대가 바뀌면 바뀐 시간대의 자정을 기준으로 한다', () => {
    // Given
    const now = toInstant('2026-07-14T14:59:59.900Z');

    // When
    const seoulMidnight = getNextLocalMidnight(now, 'Asia/Seoul');
    const losAngelesMidnight = getNextLocalMidnight(now, 'America/Los_Angeles');

    // Then
    expect(seoulMidnight).toBe('2026-07-14T15:00:00.000Z');
    expect(losAngelesMidnight).toBe('2026-07-15T07:00:00.000Z');
  });

  it('서머타임이 시작되는 날은 23시간 뒤에 다음 자정이 온다', () => {
    // Given
    const startOfDstDay = toInstant('2026-03-08T05:00:00.000Z');

    // When
    const nextMidnight = getNextLocalMidnight(startOfDstDay, 'America/New_York');

    // Then
    expect(nextMidnight).toBe('2026-03-09T04:00:00.000Z');
    expect(diffMs(nextMidnight, startOfDstDay)).toBe(23 * HOUR_MS);
  });

  it('서머타임이 끝나는 날은 25시간 뒤에 다음 자정이 온다', () => {
    // Given
    const startOfStandardDay = toInstant('2026-11-01T04:00:00.000Z');

    // When
    const nextMidnight = getNextLocalMidnight(startOfStandardDay, 'America/New_York');

    // Then
    expect(nextMidnight).toBe('2026-11-02T05:00:00.000Z');
    expect(diffMs(nextMidnight, startOfStandardDay)).toBe(25 * HOUR_MS);
  });

  it('자정이 01:00으로 건너뛰는 시간대에서는 그날의 첫 시각을 반환한다', () => {
    // Given
    const beforeSkippedMidnight = toInstant('2026-09-06T03:59:59.000Z');

    // When
    const nextMidnight = getNextLocalMidnight(beforeSkippedMidnight, 'America/Santiago');

    // Then
    expect(nextMidnight).toBe('2026-09-06T04:00:00.000Z');
  });

  it('자정에 23:00으로 되돌아가는 시간대에서는 실제로 날짜가 바뀌는 시각을 반환한다', () => {
    // Given
    const beforeRepeatedHour = toInstant('2026-04-05T02:59:59.000Z');

    // When
    const nextMidnight = getNextLocalMidnight(beforeRepeatedHour, 'America/Santiago');

    // Then
    expect(nextMidnight).toBe('2026-04-05T04:00:00.000Z');
  });

  it('윤년 2월 28일 다음 자정은 2월 29일, 2월 29일 다음 자정은 3월 1일이다', () => {
    // Given
    const february28 = toInstant('2028-02-28T14:59:59.000Z');
    const february29 = toInstant('2028-02-29T14:59:59.000Z');

    // When
    const afterFebruary28 = getNextLocalMidnight(february28, 'Asia/Seoul');
    const afterFebruary29 = getNextLocalMidnight(february29, 'Asia/Seoul');

    // Then
    expect(afterFebruary28).toBe('2028-02-28T15:00:00.000Z');
    expect(afterFebruary29).toBe('2028-02-29T15:00:00.000Z');
    expect(addDaysToDateKey('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDaysToDateKey('2028-02-29', 1)).toBe('2028-03-01');
  });
});

describe('getNowInstant', () => {
  afterEach(() => {
    // oxlint-disable-next-line jest/no-restricted-jest-methods -- 1.15.2 전환 #1400
    jest.useRealTimers();
  });

  it('고정한 시계의 지금을 밀리초까지 같은 순간으로 돌려준다', () => {
    // Given
    // oxlint-disable-next-line jest/no-restricted-jest-methods -- 1.15.2 전환 #1400
    jest.useFakeTimers({ now: new Date('2026-10-01T14:59:59.999Z') });

    // When
    const now = getNowInstant();

    // Then
    expect(now).toBe('2026-10-01T14:59:59.999Z');
    expect(toDateKey(now, 'Asia/Seoul')).toBe('2026-10-01');
  });

  it('서머타임이 끝나는 날 같은 벽시계 한 시간이 두 번 와도 서로 다른 순간이다', () => {
    // Given
    // oxlint-disable-next-line jest/no-restricted-jest-methods -- 1.15.2 전환 #1400
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

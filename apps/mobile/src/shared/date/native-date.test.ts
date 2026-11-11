import { range } from 'es-toolkit';

import { toEpochMs } from './instant';
import { getDateWithTime, getPickerTimeOfDay, instantFromDate, toPickerDate } from './native-date';
import { toDateKey } from './zoned';

const FALLBACK_TIME = '09:00';

describe('instantFromDate', () => {
  it('Date를 같은 순간의 Instant로 바꾸고 다시 Date로 읽어도 같다', () => {
    // Given
    const date = new Date(2026, 10, 7, 23, 30);

    // When
    const instant = instantFromDate(date);

    // Then
    expect(toEpochMs(instant)).toBe(date.getTime());
  });

  it('자정 직전과 정각이 시간대에 따라 다른 날짜로 읽힌다', () => {
    // Given
    const beforeMidnight = instantFromDate(new Date('2026-10-01T14:59:59.999Z'));
    const atMidnight = instantFromDate(new Date('2026-10-01T15:00:00.000Z'));

    // When
    const beforeKey = toDateKey(beforeMidnight, 'Asia/Seoul');
    const atKey = toDateKey(atMidnight, 'Asia/Seoul');

    // Then
    expect(beforeKey).toBe('2026-10-01');
    expect(atKey).toBe('2026-10-02');
  });
});

describe('getDateWithTime', () => {
  it('유효한 HH:mm이면 날짜는 두고 시각만 바꾸고 초와 밀리초는 0으로 만든다', () => {
    // Given
    const baseDate = new Date(2026, 0, 15, 1, 2, 3, 4);

    // When
    const result = getDateWithTime(baseDate, '18:30', FALLBACK_TIME);

    // Then
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
    expect(result.getDate()).toBe(15);
    expect(result.getHours()).toBe(18);
    expect(result.getMinutes()).toBe(30);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('시간 값이 undefined이면 fallback 시각으로 맞춘다', () => {
    // Given
    const baseDate = new Date(2026, 4, 20, 22, 10, 59, 12);

    // When
    const result = getDateWithTime(baseDate, undefined, FALLBACK_TIME);

    // Then
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });

  it('시간 형식이 유효하지 않으면 fallback 시각으로 맞춘다', () => {
    // Given
    const baseDate = new Date(2026, 4, 20, 22, 10, 59, 12);

    // When
    const result = getDateWithTime(baseDate, '99:99', FALLBACK_TIME);

    // Then
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
    expect(result.getSeconds()).toBe(0);
    expect(result.getMilliseconds()).toBe(0);
  });
});

describe('toPickerDate', () => {
  it('하루의 모든 시각이 피커에서 같은 시와 분으로 돌아온다', () => {
    // Given
    const times = range(24).flatMap((hour) => [0, 30, 59].map((minute) => ({ hour, minute })));

    // When
    const roundTrips = times.map((time) => getPickerTimeOfDay(toPickerDate(time)));

    // Then
    expect(roundTrips).toEqual(times);
  });

  it('초와 밀리초는 0이다', () => {
    // When
    const result = toPickerDate({ hour: 9, minute: 0 });

    // Then
    expect([result.getSeconds(), result.getMilliseconds()]).toEqual([0, 0]);
  });
});

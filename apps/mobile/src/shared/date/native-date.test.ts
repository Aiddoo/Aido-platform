import { range } from 'es-toolkit';

import { toEpochMs } from './instant';
import { getPickerTimeOfDay, instantFromDate, toPickerDate } from './native-date';
import { toDateKey } from './zoned';

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

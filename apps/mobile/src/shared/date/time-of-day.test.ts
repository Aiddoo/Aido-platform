import { isTimeOfDayInRange, isValidHHmm, timeOfDayToHHmm, toTimeOfDay } from './time-of-day';

const MORNING = { minimumTime: { hour: 0, minute: 0 }, maximumTime: { hour: 11, minute: 59 } };

describe('isValidHHmm', () => {
  it.each(['09:00', '00:00', '23:59'])("'%s'는 유효한 HH:mm이다", (time) => {
    // When
    const result = isValidHHmm(time);

    // Then
    expect(result).toBe(true);
  });

  it.each(['9:00', '99:99', '24:00', 'invalid', ''])("'%s'는 유효한 HH:mm이 아니다", (time) => {
    // When
    const result = isValidHHmm(time);

    // Then
    expect(result).toBe(false);
  });
});

describe('toTimeOfDay', () => {
  it.each([
    ['18:30', { hour: 18, minute: 30 }],
    ['00:05', { hour: 0, minute: 5 }],
  ])("'%s'를 시와 분으로 나눈다", (time, expected) => {
    // When
    const result = toTimeOfDay(time);

    // Then
    expect(result).toEqual(expected);
  });
});

describe('timeOfDayToHHmm', () => {
  it.each(['00:05', '09:00', '18:30', '23:59'])(
    "'%s'로 나눈 시와 분을 같은 HH:mm으로 되돌린다",
    (time) => {
      // When
      const result = timeOfDayToHHmm(toTimeOfDay(time));

      // Then
      expect(result).toBe(time);
    },
  );
});

describe('isTimeOfDayInRange', () => {
  it('범위의 양 끝 시각은 안에 든다', () => {
    // Given
    // 오전 범위 00:00~11:59

    // When
    const first = isTimeOfDayInRange({ hour: 0, minute: 0 }, MORNING);
    const last = isTimeOfDayInRange({ hour: 11, minute: 59 }, MORNING);

    // Then
    expect([first, last]).toEqual([true, true]);
  });

  it('오후 시각은 오전 범위 밖이다', () => {
    // Given
    // 오전 범위 00:00~11:59

    // When
    const result = isTimeOfDayInRange({ hour: 12, minute: 0 }, MORNING);

    // Then
    expect(result).toBe(false);
  });
});

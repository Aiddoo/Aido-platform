import { getDateWithTime, isValidHHmm, getHour, getMinute, getTodayAt } from './time-of-day';

const FALLBACK_TIME = '09:00';

describe('time utils', () => {
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

  describe('getHour / getMinute', () => {
    it("'18:30'에서 시와 분을 분리한다", () => {
      // When
      const hour = getHour('18:30');
      const minute = getMinute('18:30');

      // Then
      expect(hour).toBe(18);
      expect(minute).toBe(30);
    });

    it("'00:05' 경계값을 처리한다", () => {
      // When
      const hour = getHour('00:05');
      const minute = getMinute('00:05');

      // Then
      expect(hour).toBe(0);
      expect(minute).toBe(5);
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

  describe('getTodayAt', () => {
    it('주어진 시와 분을 오늘 날짜에 반영한다', () => {
      // When
      const result = getTodayAt(14, 30);

      // Then
      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    it('초와 밀리초는 0으로 초기화한다', () => {
      // When
      const result = getTodayAt(9, 0);

      // Then
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('0시 0분을 그대로 반영한다', () => {
      // When
      const result = getTodayAt(0, 0);

      // Then
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });

    it('23시 30분을 그대로 반영한다', () => {
      // When
      const result = getTodayAt(23, 30);

      // Then
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(30);
    });
  });
});

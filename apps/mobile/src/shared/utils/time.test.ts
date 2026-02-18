import { getDateWithTime, toHHmm } from './time';

const FALLBACK_TIME = '09:00';

describe('time utils', () => {
  describe('toHHmm', () => {
    it('Date 객체를 HH:mm 형식 문자열로 변환해야 한다', () => {
      const date = new Date(2026, 0, 15, 9, 5, 33, 999);

      expect(toHHmm(date)).toBe('09:05');
    });
  });

  describe('getDateWithTime', () => {
    it('유효한 시간 문자열이면 해당 시간을 날짜에 반영해야 한다', () => {
      const baseDate = new Date(2026, 0, 15, 1, 2, 3, 4);

      const result = getDateWithTime(baseDate, '18:30', FALLBACK_TIME);

      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
      expect(result.getHours()).toBe(18);
      expect(result.getMinutes()).toBe(30);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('시간 값이 undefined이면 fallback 시간을 사용해야 한다', () => {
      const baseDate = new Date(2026, 4, 20, 22, 10, 59, 12);

      const result = getDateWithTime(baseDate, undefined, FALLBACK_TIME);

      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('시간 형식이 유효하지 않으면 fallback 시간을 사용해야 한다', () => {
      const baseDate = new Date(2026, 4, 20, 22, 10, 59, 12);

      const result = getDateWithTime(baseDate, '99:99', FALLBACK_TIME);

      expect(result.getHours()).toBe(9);
      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });
});

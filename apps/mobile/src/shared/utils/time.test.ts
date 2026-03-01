import { formatReminderHour, getDateWithTime, hourToDate, toHHmm } from './time';

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

  describe('hourToDate', () => {
    it('주어진 시간이 Date 객체에 반영되어야 한다', () => {
      const result = hourToDate(14);

      expect(result.getHours()).toBe(14);
    });

    it('minutes, seconds, milliseconds가 0으로 초기화되어야 한다', () => {
      const result = hourToDate(9);

      expect(result.getMinutes()).toBe(0);
      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('경계값 0시를 처리해야 한다', () => {
      expect(hourToDate(0).getHours()).toBe(0);
    });

    it('경계값 23시를 처리해야 한다', () => {
      expect(hourToDate(23).getHours()).toBe(23);
    });
  });

  describe('formatReminderHour', () => {
    it('0시 → 12시 AM/오전 형태', () => {
      const result = formatReminderHour(0);
      expect(result).toMatch(/12/);
      expect(result).toMatch(/00/);
    });

    it('8시 → 8시 AM/오전 형태', () => {
      const result = formatReminderHour(8);
      expect(result).toMatch(/8/);
      expect(result).toMatch(/00/);
    });

    it('12시 → 12시 PM/오후 형태', () => {
      const result = formatReminderHour(12);
      expect(result).toMatch(/12/);
      expect(result).toMatch(/00/);
    });

    it('18시 → 6시 PM/오후 형태', () => {
      const result = formatReminderHour(18);
      expect(result).toMatch(/6/);
      expect(result).toMatch(/00/);
    });
  });
});

import {
  formatTimeDisplay,
  getDateWithTime,
  isTwelveHour,
  isValidHHmm,
  parseHour,
  parseMinute,
  resolveTimeOrFallback,
  timeToDate,
  toHHmm,
  withTime,
} from './time';

const FALLBACK_TIME = '09:00';

describe('time utils', () => {
  describe('isValidHHmm', () => {
    it.each(['09:00', '00:00', '23:59'])("'%s'는 유효한 HH:mm이다", (time) => {
      expect(isValidHHmm(time)).toBe(true);
    });

    it.each(['9:00', '99:99', '24:00', 'invalid', ''])("'%s'는 유효한 HH:mm이 아니다", (time) => {
      expect(isValidHHmm(time)).toBe(false);
    });
  });

  describe('parseHour / parseMinute', () => {
    it("'18:30'에서 시와 분을 분리한다", () => {
      expect(parseHour('18:30')).toBe(18);
      expect(parseMinute('18:30')).toBe(30);
    });

    it("'00:05' 경계값을 처리한다", () => {
      expect(parseHour('00:05')).toBe(0);
      expect(parseMinute('00:05')).toBe(5);
    });
  });

  describe('resolveTimeOrFallback', () => {
    it('유효한 시간 문자열이면 그대로 반환한다', () => {
      expect(resolveTimeOrFallback('18:30', FALLBACK_TIME)).toBe('18:30');
    });

    it.each([undefined, '99:99', '9:00', 'invalid'])('%s이면 fallback을 반환한다', (time) => {
      expect(resolveTimeOrFallback(time, FALLBACK_TIME)).toBe(FALLBACK_TIME);
    });
  });

  describe('withTime', () => {
    it('날짜는 보존하고 시·분을 적용한다', () => {
      // Given
      const base = new Date(2026, 0, 15, 1, 2, 3, 4);

      // When
      const result = withTime(base, 18, 30);

      // Then
      expect(result.getFullYear()).toBe(2026);
      expect(result.getMonth()).toBe(0);
      expect(result.getDate()).toBe(15);
      expect(result.getHours()).toBe(18);
      expect(result.getMinutes()).toBe(30);
    });

    it('초/밀리초를 0으로 초기화한다', () => {
      const result = withTime(new Date(2026, 0, 15, 1, 2, 3, 4), 9, 0);

      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });
  });

  describe('isTwelveHour', () => {
    it('TWELVE_HOUR이면 true를 반환한다', () => {
      expect(isTwelveHour('TWELVE_HOUR')).toBe(true);
    });

    it('TWENTY_FOUR_HOUR이면 false를 반환한다', () => {
      expect(isTwelveHour('TWENTY_FOUR_HOUR')).toBe(false);
    });
  });

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

  describe('timeToDate', () => {
    it('주어진 시간과 분이 Date 객체에 반영되어야 한다', () => {
      const result = timeToDate(14, 30);

      expect(result.getHours()).toBe(14);
      expect(result.getMinutes()).toBe(30);
    });

    it('seconds, milliseconds가 0으로 초기화되어야 한다', () => {
      const result = timeToDate(9, 0);

      expect(result.getSeconds()).toBe(0);
      expect(result.getMilliseconds()).toBe(0);
    });

    it('경계값 0시 0분을 처리해야 한다', () => {
      const result = timeToDate(0, 0);
      expect(result.getHours()).toBe(0);
      expect(result.getMinutes()).toBe(0);
    });

    it('경계값 23시 30분을 처리해야 한다', () => {
      const result = timeToDate(23, 30);
      expect(result.getHours()).toBe(23);
      expect(result.getMinutes()).toBe(30);
    });
  });

  describe('formatTimeDisplay', () => {
    const koSeoul = { locale: 'ko-KR', timeZone: 'Asia/Seoul' } as const;

    it('HH:mm 시각을 사용자 시간 형식과 표시 언어로 바꾼다', () => {
      expect(formatTimeDisplay('14:30', 'TWENTY_FOUR_HOUR', koSeoul)).toBe('14:30');
      expect(formatTimeDisplay('14:30', 'TWELVE_HOUR', koSeoul)).toBe('오후 2:30');
    });

    it('유효하지 않은 시간 문자열이면 원본을 반환해야 한다', () => {
      expect(formatTimeDisplay('invalid', 'TWELVE_HOUR', koSeoul)).toBe('invalid');
    });
  });
});

import { calculateTodaySchedule } from './calculate-today-schedule';

const TODAY = new Date(2025, 5, 10, 15, 30);
const TODAY_MIDNIGHT = new Date(2025, 5, 10);

describe('calculateTodaySchedule', () => {
  describe('startDate 계산', () => {
    it('startDate는 오늘 날짜의 자정(00:00:00)이 된다', () => {
      // When
      const result = calculateTodaySchedule(null, TODAY);

      // Then
      expect(result.startDate).toEqual(TODAY_MIDNIGHT);
    });
  });

  describe('endDate 처리', () => {
    it('endDate가 null이면 null을 유지한다', () => {
      // When
      const result = calculateTodaySchedule(null, TODAY);

      // Then
      expect(result.endDate).toBeNull();
    });

    it('endDate가 오늘 이후이면 기존 endDate를 그대로 유지한다', () => {
      // Given: endDate(6/15)가 오늘(6/10)보다 미래
      const endDate = new Date(2025, 5, 15);

      // When
      const result = calculateTodaySchedule(endDate, TODAY);

      // Then
      expect(result.endDate).toEqual(endDate);
    });

    it('endDate가 오늘과 같으면 기존 endDate를 그대로 유지한다', () => {
      // Given: endDate(6/10)가 오늘(6/10)과 같음
      const endDate = new Date(2025, 5, 10);

      // When
      const result = calculateTodaySchedule(endDate, TODAY);

      // Then
      expect(result.endDate).toEqual(endDate);
    });

    it('endDate가 오늘보다 과거이면 null로 리셋한다', () => {
      // Given: 기간 할일의 endDate(6/8)가 오늘(6/10)보다 과거 → start > end 역전 방지
      const endDate = new Date(2025, 5, 8);

      // When
      const result = calculateTodaySchedule(endDate, TODAY);

      // Then
      expect(result.endDate).toBeNull();
    });
  });
});

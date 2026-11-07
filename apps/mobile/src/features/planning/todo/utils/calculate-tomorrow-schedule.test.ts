import { fromDate } from '@src/shared/date/instant';

import { calculateTomorrowSchedule } from './calculate-tomorrow-schedule';

const TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone;
const TODAY = new Date(2025, 5, 10);
const TOMORROW = new Date(2025, 5, 11);

describe('calculateTomorrowSchedule', () => {
  describe('startDate 계산', () => {
    it('startDate는 오늘 기준 내일이 된다', () => {
      // When
      const result = calculateTomorrowSchedule(null, TODAY, TIME_ZONE);

      // Then
      expect(result.startDate).toEqual(TOMORROW);
    });

    it('오늘이 하루 중 시각을 가져도 startDate는 내일 자정이 된다', () => {
      // Given: 공유 today는 자정이 아닌 현재 시각을 담는다
      const todayAfternoon = new Date(2025, 5, 10, 15, 30);

      // When
      const result = calculateTomorrowSchedule(null, todayAfternoon, TIME_ZONE);

      // Then
      expect(result.startDate).toEqual(TOMORROW);
    });
  });

  describe('endDate 처리', () => {
    it('endDate가 null이면 null을 유지한다', () => {
      // When
      const result = calculateTomorrowSchedule(null, TODAY, TIME_ZONE);

      // Then
      expect(result.endDate).toBeNull();
    });

    it('endDate가 내일보다 이후이면 기존 endDate를 유지한다', () => {
      // Given
      const endDate = fromDate(new Date(2025, 5, 15));

      // When
      const result = calculateTomorrowSchedule(endDate, TODAY, TIME_ZONE);

      // Then
      expect(result.endDate).toEqual(endDate);
    });

    it('endDate가 내일보다 이전이면 null로 초기화한다', () => {
      // Given
      const endDate = fromDate(new Date(2025, 5, 9));

      // When
      const result = calculateTomorrowSchedule(endDate, TODAY, TIME_ZONE);

      // Then
      expect(result.endDate).toBeNull();
    });

    it('endDate가 내일과 같은 날이면 기존 endDate를 유지한다', () => {
      // When
      const result = calculateTomorrowSchedule(fromDate(TOMORROW), TODAY, TIME_ZONE);

      // Then
      expect(result.endDate).toEqual(fromDate(TOMORROW));
    });
  });
});

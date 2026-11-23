import { toInstant } from '@src/shared/date/instant';
import { toDateKey } from '@src/shared/date/zoned';
import { createDateKey } from '@src/testing/date-key';

import { type AchievementYears, AchievementYearsPolicy } from './achievement-years.model';

// 서울은 2027-01-04 월요일 09:30(ISO 2027년 1주), LA는 아직 2027-01-03 일요일 16:30(ISO 2026년 53주)이다
const NEW_YEAR_MONDAY_MORNING_IN_SEOUL = toInstant('2027-01-04T00:30:00.000Z');

function yearsOf(...years: number[]): AchievementYears {
  return { years };
}

describe('AchievementYearsPolicy', () => {
  describe('보일 해', () => {
    it.each([
      // 월요일 주간 리마인더가 2026년 53주를 남기고 알림을 보낸 뒤다. 새해는 아직 기록이 없다
      { timezone: 'Asia/Seoul', recorded: yearsOf(2026), expected: 2026 },
      // LA는 아직 53주가 끝나지 않아 52주까지 기록이 있고 오늘의 ISO 연도도 2026이다
      { timezone: 'America/Los_Angeles', recorded: yearsOf(2026), expected: 2026 },
      // 처음 쓰는 사용자는 오늘의 ISO 연도를 본다
      { timezone: 'Asia/Seoul', recorded: yearsOf(), expected: 2027 },
      { timezone: 'America/Los_Angeles', recorded: yearsOf(), expected: 2026 },
    ])(
      '2027-01-04 09:30 KST에 $timezone 기기는 기록 있는 해 $recorded.years 중 $expected년을 보인다',
      ({ timezone, recorded, expected }) => {
        // Given
        const todayKey = toDateKey(NEW_YEAR_MONDAY_MORNING_IN_SEOUL, timezone);

        // When
        const year = AchievementYearsPolicy.getShownYear(recorded, {
          selectedYear: undefined,
          todayKey,
        });

        // Then
        expect(year).toBe(expected);
      },
    );

    it.each([
      { name: '기록 있는 해를 고르면 그 해', selectedYear: 2025, expected: 2025 },
      { name: '기록 없는 해를 고르면 가장 최근 해', selectedYear: 2024, expected: 2027 },
      { name: '고르지 않으면 가장 최근 해', selectedYear: undefined, expected: 2027 },
    ])('$name를 보인다', ({ selectedYear, expected }) => {
      // When
      const year = AchievementYearsPolicy.getShownYear(yearsOf(2027, 2025), {
        selectedYear,
        todayKey: createDateKey('2027-03-01'),
      });

      // Then
      expect(year).toBe(expected);
    });
  });

  describe('이전·다음 해', () => {
    it.each([
      { shownYear: 2027, previous: 2025, next: null },
      { shownYear: 2025, previous: 2022, next: 2027 },
      { shownYear: 2022, previous: null, next: 2025 },
    ])(
      '기록 없는 해를 건너뛰어 $shownYear년의 이전은 $previous, 다음은 $next다',
      ({ shownYear, previous, next }) => {
        // Given
        const recorded = yearsOf(2027, 2025, 2022);

        // When
        const neighbors = {
          previous: AchievementYearsPolicy.findPreviousYear(recorded, shownYear),
          next: AchievementYearsPolicy.findNextYear(recorded, shownYear),
        };

        // Then
        expect(neighbors).toEqual({ previous, next });
      },
    );
  });
});

import { type DateKey, getIsoWeekYear } from '@src/shared/date/date-key';
import { last } from 'es-toolkit';
import { z } from 'zod';

const achievementYearsSchema = z.object({
  /** 주간 기록이 하나라도 있는 ISO 연도. 최근 해가 먼저다 */
  years: z.array(z.int()),
});
export type AchievementYears = z.infer<typeof achievementYearsSchema>;

interface ShownYearInput {
  /** URL에서 고른 해. 고르지 않았으면 undefined다 */
  selectedYear: number | undefined;
  todayKey: DateKey;
}

export const AchievementYearsPolicy = {
  /** 고른 해에 기록이 없으면 기록 있는 가장 최근 해라 해가 바뀐 월요일에도 지난해 53주가 빈 새해 대신 보인다 */
  getShownYear(
    achievementYears: AchievementYears,
    { selectedYear, todayKey }: ShownYearInput,
  ): number {
    if (selectedYear != null && achievementYears.years.includes(selectedYear)) {
      return selectedYear;
    }
    return achievementYears.years[0] ?? getIsoWeekYear(todayKey);
  },

  /** 보이는 해보다 앞선 기록 있는 해 중 가장 가까운 해. 없으면 null */
  findPreviousYear(achievementYears: AchievementYears, shownYear: number): number | null {
    return achievementYears.years.find((year) => year < shownYear) ?? null;
  },

  /** 보이는 해보다 뒤의 기록 있는 해 중 가장 가까운 해. 없으면 null */
  findNextYear(achievementYears: AchievementYears, shownYear: number): number | null {
    return last(achievementYears.years.filter((year) => year > shownYear)) ?? null;
  },
};

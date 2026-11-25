import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useTodayKey } from '@src/shared/hooks/use-today-key';

import { type AchievementYears, AchievementYearsPolicy } from '../domains/achievement-years.model';
import {
  achievementListParamsSchema,
  achievementParamsSchema,
} from '../schemas/achievement-params.schema';

/** 주 상장 주소의 ISO 연·주. 상세 화면과 상장이 같은 값을 읽는다 */
export function useAchievementWeek() {
  const [{ year, week }] = useRouteParams(achievementParamsSchema);

  return [{ year, week }] as const;
}

/** 배지 화면 URL에서 고른 해(`year`). 고르지 않았으면 undefined다 */
export function useSelectedAchievementYear() {
  const [{ year }] = useRouteParams(achievementListParamsSchema);

  return [year] as const;
}

/**
 * 배지 화면이 보이는 ISO 연도와 그 해를 고르는 세터. 고른 해가 기록 없는 해면 기록 있는 가장 최근 해다.
 * 기록 있는 연도는 부르는 컴포넌트가 조회해 넘긴다(Suspense 조회를 훅에 숨기지 않는다)
 */
export function useAchievementYear(achievementYears: AchievementYears) {
  const todayKey = useTodayKey();
  const [{ year: selectedYear }, setParams] = useRouteParams(achievementListParamsSchema);
  const shownYear = AchievementYearsPolicy.getShownYear(achievementYears, {
    selectedYear,
    todayKey,
  });
  const setShownYear = (year: number) => setParams({ year });

  return [shownYear, setShownYear] as const;
}

import { createTestQueryClient } from '@src/shared/__tests__';
import type { QueryClient } from '@tanstack/react-query';

import { invalidateWeeklyAchievements } from './achievement-cache';
import { ACHIEVEMENT_QUERY_KEYS } from './achievement-query-keys';

describe('invalidateWeeklyAchievements', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
  });

  it('해당 연도 주간 목록만 무효화하고 주간 상세와 다른 연도 목록은 그대로 둔다', async () => {
    // Given
    const list = ACHIEVEMENT_QUERY_KEYS.weeklyList({ year: 2026 });
    const otherYearList = ACHIEVEMENT_QUERY_KEYS.weeklyList({ year: 2025 });
    const detail = ACHIEVEMENT_QUERY_KEYS.weeklyDetail({ year: 2026, week: 10 });
    queryClient.setQueryData(list, { pages: [], pageParams: [] });
    queryClient.setQueryData(otherYearList, { pages: [], pageParams: [] });
    queryClient.setQueryData(detail, { id: 1 });

    // When
    await invalidateWeeklyAchievements(queryClient, { year: 2026 });

    // Then
    expect(queryClient.getQueryState(list)?.isInvalidated).toBe(true);
    expect(queryClient.getQueryState(otherYearList)?.isInvalidated).toBe(false);
    expect(queryClient.getQueryState(detail)?.isInvalidated).toBe(false);
  });
});

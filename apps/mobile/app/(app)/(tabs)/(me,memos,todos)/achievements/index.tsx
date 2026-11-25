import { AchievementSummary } from '@src/features/insights/achievement/components/achievement-summary';
import { AchievementYearBar } from '@src/features/insights/achievement/components/achievement-year-bar';
import { WeeklyAchievementList } from '@src/features/insights/achievement/components/weekly-achievement-list';
import { useSelectedAchievementYear } from '@src/features/insights/achievement/hooks/use-achievement-params';
import {
  useGetAchievementYearsQueryOptions,
  useGetWeeklyAchievementsInfiniteQueryOptions,
} from '@src/features/insights/achievement/queries/achievement.queries';
import { getIsoWeekYear } from '@src/shared/date/date-key';
import { useTodayKey } from '@src/shared/hooks/use-today-key';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  QueryErrorBoundary,
  QueryErrorFallback,
  type QueryErrorFallbackProps,
  Spacing,
  StyledSafeAreaView,
  Text,
} from '@src/shared/ui';
import { usePrefetchInfiniteQuery, usePrefetchQuery } from '@tanstack/react-query';
import { Stack } from 'expo-router';
import { Suspense } from 'react';

export default function AchievementsScreen() {
  const { t } = useTranslation('achievement');

  const [selectedYear] = useSelectedAchievementYear();

  const todayKey = useTodayKey();
  // 보일 해는 기록 있는 연도를 받아야 정해진다. 대개 고른 해나 올해라 그 목록을 함께 받기 시작해 기다림을 겹친다
  usePrefetchQuery(useGetAchievementYearsQueryOptions());
  usePrefetchInfiniteQuery(
    useGetWeeklyAchievementsInfiniteQueryOptions({
      year: selectedYear ?? getIsoWeekYear(todayKey),
    }),
  );

  return (
    <>
      <Stack.Screen options={{ title: t('titles.index') }} />

      <StyledSafeAreaView className="flex-1 bg-white" edges={['left', 'right']}>
        <QueryErrorBoundary
          resetKeys={[selectedYear, getIsoWeekYear(todayKey)]}
          fallback={WeeklyAchievementListErrorFallback}
        >
          <Suspense fallback={<WeeklyAchievementList.Loading header={<AchievementOverview />} />}>
            <WeeklyAchievementList header={<AchievementOverview />} />
          </Suspense>
        </QueryErrorBoundary>
      </StyledSafeAreaView>
    </>
  );
}

function WeeklyAchievementListErrorFallback(props: QueryErrorFallbackProps) {
  return <WeeklyAchievementList.Error {...props} header={<AchievementOverview />} />;
}

function AchievementOverview() {
  const { t } = useTranslation('achievement');

  return (
    <>
      <Spacing size={16} />

      {/* 연도를 받지 못하면 배지·기록 경계가 다시 시도를 보이므로 막대는 자리를 비운다 */}
      <QueryErrorBoundary fallback={QueryErrorFallback.Hidden}>
        {/* 기록이 올해뿐이면 숨는 막대라 받는 동안 자리를 비우지 않고, 숨을 때 간격도 사라지게 아래 12를 자기 className으로 가진다 */}
        <Suspense fallback={null}>
          <AchievementYearBar className="mb-3" />
        </Suspense>
      </QueryErrorBoundary>

      <QueryErrorBoundary fallback={AchievementSummary.Error}>
        <Suspense fallback={<AchievementSummary.Loading />}>
          <AchievementSummary />
        </Suspense>
      </QueryErrorBoundary>

      <Spacing size={24} />

      <Box className="px-1">
        <Text size="b2" shade={8} weight="bold">
          {t('list.sectionTitle')}
        </Text>
      </Box>

      <Spacing size={8} />
    </>
  );
}

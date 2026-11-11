import { AchievementSummary } from '@src/features/insights/achievement/components/achievement-summary';
import { WeeklyAchievementList } from '@src/features/insights/achievement/components/weekly-achievement-list';
import { getYearOfDateKey } from '@src/shared/date/date-key';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, Spacing, StyledSafeAreaView, Text, Box } from '@src/shared/ui';
import { Suspense } from 'react';

export default function AchievementsScreen() {
  const { t } = useTranslation('achievement');
  const todayKey = useTodayKey();

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['left', 'right', 'bottom']}>
      <QueryErrorBoundary
        resetKeys={[getYearOfDateKey(todayKey)]}
        fallback={WeeklyAchievementList.Error}
      >
        <Suspense
          fallback={
            <Box className="px-4">
              <Spacing size={16} />
              <AchievementSummary.Loading />
              <Spacing size={24} />
              <Box className="px-1 pb-2">
                <Text size="b2" shade={8} weight="bold">
                  {t('list.sectionTitle')}
                </Text>
              </Box>
              <WeeklyAchievementList.Loading />
            </Box>
          }
        >
          <WeeklyAchievementList
            ListHeaderComponent={
              <>
                <Spacing size={16} />
                <QueryErrorBoundary fallback={AchievementSummary.Error}>
                  <Suspense fallback={<AchievementSummary.Loading />}>
                    <AchievementSummary />
                  </Suspense>
                </QueryErrorBoundary>
                <Spacing size={24} />
                <Box className="px-1 pb-2">
                  <Text size="b2" shade={8} weight="bold">
                    {t('list.sectionTitle')}
                  </Text>
                </Box>
              </>
            }
          />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}

import { AchievementSummary } from '@src/features/insights/achievement/components/achievement-summary';
import { WeeklyAchievementList } from '@src/features/insights/achievement/components/weekly-achievement-list';
import { getYearOfDateKey } from '@src/shared/date/date-key';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  Spacing,
  StyledSafeAreaView,
  Text,
} from '@src/shared/ui';
import { Stack } from 'expo-router';
import { Suspense } from 'react';

export default function AchievementsScreen() {
  const { t } = useTranslation('achievement');

  const todayKey = useTodayKey();

  return (
    <>
      <Stack.Screen options={{ title: t('titles.index') }} />

      <StyledSafeAreaView className="flex-1 bg-white" edges={['left', 'right']}>
        <QueryErrorBoundary
          resetKeys={[getYearOfDateKey(todayKey)]}
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

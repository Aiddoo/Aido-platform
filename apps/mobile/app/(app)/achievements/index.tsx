import { AchievementSummaryCard } from '@src/features/achievement/components/achievement-summary-card';
import { WeeklyAchievementList } from '@src/features/achievement/components/weekly-achievement-list';
import { useToday } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, Spacing, StyledSafeAreaView, Text } from '@src/shared/ui';
import { Suspense } from 'react';
import { View } from 'react-native';

export default function AchievementsScreen() {
  const today = useToday();

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['left', 'right', 'bottom']}>
      <QueryErrorBoundary
        resetKeys={[today.getFullYear()]}
        fallback={(props) => <WeeklyAchievementList.Error {...props} />}
      >
        <Suspense
          fallback={
            <View className="px-4">
              <Spacing size={16} />
              <AchievementSummaryCard.Loading />
              <Spacing size={24} />
              <HistoryTitle />
              <WeeklyAchievementList.Loading />
            </View>
          }
        >
          <WeeklyAchievementList
            ListHeaderComponent={
              <>
                <Spacing size={16} />
                <QueryErrorBoundary
                  fallback={(props) => <AchievementSummaryCard.Error {...props} />}
                >
                  <Suspense fallback={<AchievementSummaryCard.Loading />}>
                    <AchievementSummaryCard />
                  </Suspense>
                </QueryErrorBoundary>
                <Spacing size={24} />
                <HistoryTitle />
              </>
            }
          />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}

function HistoryTitle() {
  const { t } = useTranslation('achievement');

  return (
    <View className="px-1 pb-2">
      <Text size="b2" shade={8} weight="bold">
        {t('list.sectionTitle')}
      </Text>
    </View>
  );
}

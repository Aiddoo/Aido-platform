import { WeeklyAchievementCertificate } from '@src/features/insights/achievement/components/weekly-achievement-certificate';
import { achievementParamsSchema } from '@src/features/insights/achievement/schemas/achievement-params.schema';
import { QueryErrorBoundary, StyledSafeAreaView } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

export default function AchievementDetailScreen() {
  const params = useLocalSearchParams();
  const parsed = achievementParamsSchema.safeParse(params);

  if (!parsed.success) {
    return <Redirect href="/achievements" />;
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <ScrollView
        contentContainerClassName="px-4"
        contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
      >
        <StyledSafeAreaView edges={['left', 'right']} className="grow justify-center">
          <QueryErrorBoundary
            resetKeys={[parsed.data.year, parsed.data.week]}
            fallback={WeeklyAchievementCertificate.Error}
          >
            <Suspense fallback={<WeeklyAchievementCertificate.Loading />}>
              <WeeklyAchievementCertificate />
            </Suspense>
          </QueryErrorBoundary>
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}

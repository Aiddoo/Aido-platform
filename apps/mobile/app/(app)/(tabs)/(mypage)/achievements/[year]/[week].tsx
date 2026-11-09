import { WeeklyAchievementCertificate } from '@src/features/insights/achievement/components/weekly-achievement-certificate';
import { achievementParamsSchema } from '@src/features/insights/achievement/schemas/achievement-params.schema';
import { Box, QueryErrorBoundary, SafeAreaScrollView } from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';

export default function AchievementDetailScreen() {
  const params = useLocalSearchParams();
  const parsed = achievementParamsSchema.safeParse(params);

  if (!parsed.success) {
    return <Redirect href="/achievements" />;
  }

  return (
    <SafeAreaScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
    >
      <Box className="grow justify-center px-4">
        <QueryErrorBoundary
          resetKeys={[parsed.data.year, parsed.data.week]}
          fallback={WeeklyAchievementCertificate.Error}
        >
          <Suspense fallback={<WeeklyAchievementCertificate.Loading />}>
            <WeeklyAchievementCertificate />
          </Suspense>
        </QueryErrorBoundary>
      </Box>
    </SafeAreaScrollView>
  );
}

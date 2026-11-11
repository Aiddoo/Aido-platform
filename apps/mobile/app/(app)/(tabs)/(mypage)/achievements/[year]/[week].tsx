import { WeeklyAchievementCertificate } from '@src/features/insights/achievement/components/weekly-achievement-certificate';
import { achievementParamsSchema } from '@src/features/insights/achievement/schemas/achievement-params.schema';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { Box, QueryErrorBoundary, SafeAreaScrollView } from '@src/shared/ui';
import { Suspense } from 'react';

export default function AchievementDetailRoute() {
  const route = useRouteParamsOrRedirect(achievementParamsSchema, {
    fallbackHref: '/achievements',
  });

  if (route.redirect != null) {
    return route.redirect;
  }

  return <AchievementDetailScreen />;
}

function AchievementDetailScreen() {
  const [{ year, week }] = useRouteParams(achievementParamsSchema);

  return (
    <SafeAreaScrollView
      className="flex-1 bg-white"
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center' }}
    >
      <Box className="grow justify-center px-4">
        <QueryErrorBoundary resetKeys={[year, week]} fallback={WeeklyAchievementCertificate.Error}>
          <Suspense fallback={<WeeklyAchievementCertificate.Loading />}>
            <WeeklyAchievementCertificate />
          </Suspense>
        </QueryErrorBoundary>
      </Box>
    </SafeAreaScrollView>
  );
}

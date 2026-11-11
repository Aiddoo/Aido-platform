import { ActivityReport } from '@src/features/insights/report/components/activity-report';
import { SavedActivityReport } from '@src/features/insights/report/components/saved-activity-report';
import { getSampleReport } from '@src/features/insights/report/constants/sample-reports.constants';
import { reportParamsSchema } from '@src/features/insights/report/schemas/report-params.schema';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  Button,
  QueryErrorBoundary,
  SafeAreaScrollView,
  Spacing,
  Text,
  VStack,
} from '@src/shared/ui';
import { router } from 'expo-router';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

export default function ReportDetailRoute() {
  const route = useRouteParamsOrRedirect(reportParamsSchema, { fallbackHref: '/reports' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return <ReportDetailScreen />;
}

function ReportDetailScreen() {
  const { t } = useTranslation('ai');
  const [{ reportId }] = useRouteParams(reportParamsSchema);
  const push = useSingleTap(router.push);

  return (
    <SafeAreaScrollView className="flex-1 bg-white px-4" contentContainerClassName="grow">
      <Box className="grow pb-8">
        {match(reportId)
          .with({ kind: 'sample' }, ({ id }) => (
            <>
              <Spacing size={8} />

              <ActivityReport report={getSampleReport(id)} />

              <Spacing size={32} />

              <VStack gap={8} align="center">
                <Text size="b3" weight="bold" shade={9}>
                  {t('report.lockedDetail.title')}
                </Text>
                <Text size="b4" shade={6} className="text-center">
                  {t('report.lockedDetail.description')}
                </Text>
                <Spacing size={4} />
                <Button
                  size="medium"
                  onPress={() =>
                    push({
                      pathname: '/paywall',
                      params: { feature: 'AI_REPORT' },
                    })
                  }
                >
                  {t('report.lockedDetail.subscribe')}
                </Button>
              </VStack>

              <Spacing size={24} />
            </>
          ))
          .with({ kind: 'saved' }, ({ id }) => (
            <>
              <Spacing size={16} />

              <QueryErrorBoundary resetKeys={[id]} fallback={ActivityReport.Error}>
                <Suspense fallback={<ActivityReport.Loading />}>
                  <SavedActivityReport />
                </Suspense>
              </QueryErrorBoundary>
            </>
          ))
          .exhaustive()}
      </Box>
    </SafeAreaScrollView>
  );
}

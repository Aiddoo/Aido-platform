import { ActivityReport } from '@src/features/ai/components/activity-report';
import { getSampleReport } from '@src/features/ai/constants/sample-reports';
import {
  reportScreenParamsSchema,
  useReportScreenParams,
} from '@src/features/ai/hooks/use-report-screen-params';
import { useGetReportDetailQueryOptions } from '@src/features/ai/queries/get-report-detail-query-options';
import { useTrack } from '@src/shared/analytics';
import { classifyBoundaryError } from '@src/shared/errors';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  QueryErrorBoundary,
  QueryErrorFallback,
  Spacing,
  StyledSafeAreaView,
  Text,
  usePremiumDialog,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { Suspense, useEffect } from 'react';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

function ReportDetailScreen() {
  const { id: report } = useReportScreenParams();
  const { t } = useTranslation('ai');
  const { trackEvent } = useTrack();
  const premiumDialog = usePremiumDialog();

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      {match(report)
        .with({ kind: 'sample' }, ({ id }) => (
          <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8 pt-2">
            <StyledSafeAreaView edges={['left', 'right']}>
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
                  onPress={() => {
                    trackEvent('premium_gate_shown', { feature: 'ai_report' });
                    premiumDialog.open({
                      description: t('report.lockedDetail.premiumDialogDescription'),
                    });
                  }}
                >
                  {t('report.lockedDetail.subscribe')}
                </Button>
              </VStack>

              <Spacing size={24} />
            </StyledSafeAreaView>
          </ScrollView>
        ))
        .with({ kind: 'saved' }, ({ id }) => (
          <QueryErrorBoundary
            resetKeys={[id]}
            fallback={({ error, reset }) =>
              // 지워졌거나 볼 수 없는 리포트(AI_1304 등 404)는 다시 시도해도 같다. 목록으로 보낸다
              classifyBoundaryError(error) === 'expected-state' ? (
                <ActivityReport.Unavailable onBackToList={() => router.dismissTo('/reports')} />
              ) : (
                <QueryErrorFallback reset={reset} />
              )
            }
          >
            <Suspense fallback={<ActivityReport.Loading />}>
              <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
                <StyledSafeAreaView edges={['left', 'right']}>
                  <Spacing size={16} />
                  <SavedActivityReport />
                </StyledSafeAreaView>
              </ScrollView>
            </Suspense>
          </QueryErrorBoundary>
        ))
        .exhaustive()}
    </StyledSafeAreaView>
  );
}

export default function ReportDetailRoute() {
  const params = reportScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/reports" />;
  }

  return <ReportDetailScreen />;
}

function SavedActivityReport() {
  const { id: report } = useReportScreenParams();

  if (report.kind !== 'saved') {
    return null;
  }

  return <SavedActivityReport.Contents id={report.id} />;
}

SavedActivityReport.Contents = function Contents({ id }: { id: number }) {
  const { data: report } = useSuspenseQuery(useGetReportDetailQueryOptions({ id }));
  const { trackEvent } = useTrack();

  useEffect(() => {
    trackEvent('ai_report_viewed', { report_id: id, report_type: report.type });
  }, [trackEvent, id, report.type]);

  return <ActivityReport report={report} />;
};

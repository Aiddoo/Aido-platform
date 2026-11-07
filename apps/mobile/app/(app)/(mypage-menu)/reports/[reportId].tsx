import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { ActivityReport } from '@src/features/insights/report/components/activity-report';
import { getSampleReport } from '@src/features/insights/report/constants/sample-reports';
import { useReportParams } from '@src/features/insights/report/hooks/use-report-params';
import { useGetReportDetailQueryOptions } from '@src/features/insights/report/queries/report.queries';
import { reportParamsSchema } from '@src/features/insights/report/schemas/report-params.schema';
import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Suspense, useEffect } from 'react';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

function ReportDetailScreen() {
  const { reportId: report } = useReportParams();
  const { t } = useTranslation('ai');
  const gate = useEntitlementGate('AI_REPORT', { surface: 'report_detail' });

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
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
                <Button size="medium" onPress={() => gate.guard()}>
                  {t('report.lockedDetail.subscribe')}
                </Button>
              </VStack>

              <Spacing size={24} />
            </StyledSafeAreaView>
          </ScrollView>
        ))
        .with({ kind: 'saved' }, ({ id }) => (
          <QueryErrorBoundary resetKeys={[id]} fallback={ActivityReport.Error}>
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
  const params = reportParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/reports" />;
  }

  return <ReportDetailScreen />;
}

function SavedActivityReport() {
  const { reportId: report } = useReportParams();

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

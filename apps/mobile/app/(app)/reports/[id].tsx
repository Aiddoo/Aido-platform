import type { AiReport } from '@src/features/ai/models/ai.model';
import { ReportDetailContent } from '@src/features/ai/presentations/components/ReportDetailContent';
import {
  getSampleReport,
  isSampleReportId,
} from '@src/features/ai/presentations/constants/sample-reports.constant';
import {
  reportScreenParamsSchema,
  useReportScreenParams,
} from '@src/features/ai/presentations/hooks/use-report-screen-params';
import { useGetReportDetailQueryOptions } from '@src/features/ai/presentations/queries/get-report-detail-query-options';
import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  Text,
  usePremiumDialog,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Suspense, useEffect } from 'react';
import { ScrollView } from 'react-native';

const ReportDetailScreen = () => {
  const { id } = useLocalSearchParams();

  if (
    typeof id !== 'string' ||
    (!isSampleReportId(id) && !reportScreenParamsSchema.safeParse({ id }).success)
  ) {
    return <Redirect href="/reports" />;
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      {isSampleReportId(id) ? (
        <SampleReportDetail report={getSampleReport(id)} />
      ) : (
        <QueryErrorBoundary>
          <Suspense fallback={<ReportDetailContent.Loading />}>
            <ReportDetailBody />
          </Suspense>
        </QueryErrorBoundary>
      )}
    </StyledSafeAreaView>
  );
};

export default ReportDetailScreen;

function ReportDetailBody() {
  const { id } = useReportScreenParams();
  const { data: report } = useSuspenseQuery(useGetReportDetailQueryOptions(id));
  const { trackEvent } = useTrack();

  useEffect(() => {
    trackEvent('ai_report_viewed', { report_id: id, report_type: report.type });
  }, [trackEvent, id, report.type]);

  return (
    <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
      <Spacing size={16} />
      <ReportDetailContent report={report} />
    </ScrollView>
  );
}

function SampleReportDetail({ report }: { report: AiReport }) {
  const { t } = useTranslation('ai');
  const { trackEvent } = useTrack();
  const premiumDialog = usePremiumDialog();

  return (
    <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8 pt-2">
      <ReportDetailContent report={report} />

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
    </ScrollView>
  );
}

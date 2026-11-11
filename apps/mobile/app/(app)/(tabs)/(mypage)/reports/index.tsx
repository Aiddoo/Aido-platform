import { useFeatureAccess } from '@src/features/billing/subscription/hooks/use-feature-access';
import { AiConsentNotice } from '@src/features/identity/consent/components/ai-consent-notice';
import { ReportList } from '@src/features/insights/report/components/report-list';
import { ReportStatusBanner } from '@src/features/insights/report/components/report-status-banner';
import { REPORT_TYPE_LABEL_KEYS } from '@src/features/insights/report/constants/report-labels';
import { useReportType } from '@src/features/insights/report/hooks/use-report-type';
import { invalidateReports } from '@src/features/insights/report/queries/report-cache';
import { reportListTypeSchema } from '@src/features/insights/report/schemas/report-params.schema';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  H4,
  Mascot,
  QueryErrorBoundary,
  SafeAreaScrollView,
  ScallopedContainer,
  SegmentTabTrigger,
  Spacing,
  Text,
  TextSkeleton,
  TintedRefreshControl,
  ViewTabs,
  VStack,
} from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs } from 'heroui-native';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

export default function ReportsScreen() {
  const { t } = useTranslation('ai');
  const queryClient = useQueryClient();
  const featureAccess = useFeatureAccess('AI_REPORT');
  const [reportType] = useReportType();
  const [isRefreshing, handleRefresh] = useRefresh(() => invalidateReports(queryClient));

  return (
    <SafeAreaScrollView
      className="flex-1 bg-white px-4"
      refreshControl={<TintedRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      <Spacing size={16} />

      {match(featureAccess.status)
        .with('premium', () => (
          <VStack gap={12}>
            <AiConsentNotice title={t('consent.notice.reports')} />

            <ScallopedContainer>
              <Box className="items-center px-5 pt-4">
                <Mascot name="catSuggestion" size={100} />
                <Spacing size={8} />
                <H4
                  align="center"
                  lineBreakStrategyIOS="hangul-word"
                  textBreakStrategy="highQuality"
                >
                  {t('report.list.premiumTitle')}
                </H4>
                <Text size="b4" shade={6} align="center">
                  {t('report.list.premiumDescription')}
                </Text>
              </Box>

              <Spacing size={16} />

              <Box className="px-4">
                <QueryErrorBoundary fallback={ReportStatusBanner.Error}>
                  <Suspense fallback={<ReportStatusBanner.Loading />}>
                    <ReportStatusBanner />
                  </Suspense>
                </QueryErrorBoundary>
              </Box>

              <Spacing size={12} />

              <ReportTypeTabs />

              <Spacing size={8} />

              <Box className="px-4 pb-4">
                <QueryErrorBoundary fallback={ReportList.Error} resetKeys={[reportType]}>
                  <Suspense fallback={<ReportList.Loading />}>
                    <ReportList />
                  </Suspense>
                </QueryErrorBoundary>
              </Box>
            </ScallopedContainer>
          </VStack>
        ))
        .with('free', () => (
          <ScallopedContainer>
            <Box className="items-center px-5 pt-4">
              <Mascot name="catSuggestion" size={100} />
              <Spacing size={8} />
              <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
                {t('report.list.freeTitle')}
              </H4>
              <Text size="b4" shade={6} align="center">
                {t('report.list.freeDescription')}
              </Text>
            </Box>

            <Spacing size={28} />

            <ReportTypeTabs />

            <Spacing size={8} />

            <Box className="px-4 pb-4">
              <ReportList.Free />
            </Box>
          </ScallopedContainer>
        ))
        // 프리미엄 사용자가 매번 보는 화면이라 권한을 기다리는 동안에도 같은 자리를 잡는다
        .with('loading', () => (
          <ScallopedContainer>
            <Box className="items-center px-5 pt-4">
              <Mascot name="catSuggestion" size={100} />
              <Spacing size={8} />
              <TextSkeleton size="t3" className="w-40" />
              <TextSkeleton size="b4" className="w-56" />
            </Box>

            <Spacing size={16} />

            <Box className="px-4">
              <ReportStatusBanner.Loading />
            </Box>

            <Spacing size={12} />

            <ReportTypeTabs />

            <Spacing size={8} />

            <Box className="px-4 pb-4">
              <ReportList.Loading />
            </Box>
          </ScallopedContainer>
        ))
        .with('error', () => (
          <ScallopedContainer>
            <Box className="items-center px-5 pt-4">
              <Mascot name="catSuggestion" size={100} />
              <Spacing size={8} />
            </Box>

            <Spacing size={28} />

            <ReportTypeTabs />

            <Spacing size={8} />

            <Box className="px-4 pb-4">
              <ReportList.Error error={featureAccess.error} reset={() => featureAccess.refetch()} />
            </Box>
          </ScallopedContainer>
        ))
        .exhaustive()}

      <Spacing size={32} />
    </SafeAreaScrollView>
  );
}

function ReportTypeTabs() {
  const { t } = useTranslation('ai');
  const [reportType, setReportType] = useReportType();

  return (
    <Box className="px-4">
      <ViewTabs
        schema={reportListTypeSchema}
        value={reportType}
        onValueChange={setReportType}
        variant="primary"
      >
        <Tabs.List>
          <Tabs.Indicator />
          <SegmentTabTrigger value="WEEKLY">{t(REPORT_TYPE_LABEL_KEYS.WEEKLY)}</SegmentTabTrigger>
          <SegmentTabTrigger value="MONTHLY">{t(REPORT_TYPE_LABEL_KEYS.MONTHLY)}</SegmentTabTrigger>
        </Tabs.List>
      </ViewTabs>
    </Box>
  );
}

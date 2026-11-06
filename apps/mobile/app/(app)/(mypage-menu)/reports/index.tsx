import { reportTypeSchema } from '@aido/api';
import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/get-entitlements-query-options';
import { AiConsentNotice } from '@src/features/identity/consent/components/ai-consent-notice';
import { ReportCard } from '@src/features/insights/report/components/report-card';
import { ReportStatusBanner } from '@src/features/insights/report/components/report-status-banner';
import { REPORT_TYPE_LABEL_KEYS } from '@src/features/insights/report/constants/report-type';
import {
  getSampleReport,
  SAMPLE_REPORT_IDS,
} from '@src/features/insights/report/constants/sample-reports';
import type { ReportType } from '@src/features/insights/report/domains/report.model';
import { useReportTypeParam } from '@src/features/insights/report/hooks/use-report-type-param';
import { useGetReportStatusQueryOptions } from '@src/features/insights/report/queries/get-report-status-query-options';
import { useGetReportsQueryOptions } from '@src/features/insights/report/queries/get-reports-query-options';
import { invalidateAiReports } from '@src/features/insights/report/queries/report-cache';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  H4,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
  ScallopedContainer,
  Box,
} from '@src/shared/ui';
import { usePrefetchQuery, useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Tabs } from 'heroui-native';
import { Suspense } from 'react';
import { Image, RefreshControl, ScrollView } from 'react-native';
import { match } from 'ts-pattern';

function ReportsScreen() {
  const { t } = useTranslation('ai');
  const queryClient = useQueryClient();
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const canViewReports = !EntitlementPolicy.isFeatureLocked(entitlements, 'AI_REPORT');
  const [reportType, setReportType] = useReportTypeParam();
  const [refreshing, onRefresh] = useRefresh(() => invalidateAiReports(queryClient));

  return (
    <ScrollView
      className="flex-1 px-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <StyledSafeAreaView edges={['left', 'right']}>
        <Spacing size={16} />

        <VStack gap={12}>
          {canViewReports && <AiConsentNotice>{t('consent.notice.reports')}</AiConsentNotice>}

          <ScallopedContainer>
            <Box className="items-center px-5 pt-4">
              <Image
                source={require('@assets/images/ido_cat_suggestion.webp')}
                style={{ width: 100, height: 100 }}
                resizeMode="contain"
              />
              <Spacing size={8} />
              <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
                {canViewReports ? t('report.list.premiumTitle') : t('report.list.freeTitle')}
              </H4>
              <Text size="b4" shade={6} align="center">
                {canViewReports
                  ? t('report.list.premiumDescription')
                  : t('report.list.freeDescription')}
              </Text>
            </Box>

            <Spacing size={16} />

            {canViewReports && (
              <Box className="px-4">
                <QueryErrorBoundary>
                  <Suspense fallback={<ReportStatusBanner.Loading />}>
                    <ReportStatusBanner />
                  </Suspense>
                </QueryErrorBoundary>
              </Box>
            )}

            <Spacing size={12} />

            <Box className="px-4">
              <Tabs
                value={reportType}
                onValueChange={(value) => {
                  const parsed = reportTypeSchema.safeParse(value);
                  if (parsed.success) {
                    setReportType(parsed.data);
                  }
                }}
                variant="primary"
              >
                <Tabs.List>
                  <Tabs.Indicator />
                  <ReportTypeTab type="WEEKLY" />
                  <ReportTypeTab type="MONTHLY" />
                </Tabs.List>
              </Tabs>
            </Box>

            <Spacing size={8} />

            <Box className="px-4 pb-4">
              {match(canViewReports)
                .with(true, () => (
                  <QueryErrorBoundary resetKeys={[reportType]}>
                    <Suspense fallback={<ReportCard.Loading />}>
                      <ReportList />
                    </Suspense>
                  </QueryErrorBoundary>
                ))
                .with(false, () => <FreeReportPreview />)
                .exhaustive()}
            </Box>
          </ScallopedContainer>
        </VStack>

        <Spacing size={32} />
      </StyledSafeAreaView>
    </ScrollView>
  );
}

function ReportTypeTab({ type }: { type: ReportType }) {
  const { t } = useTranslation('ai');

  return (
    <Tabs.Trigger value={type}>
      {({ isSelected }) => (
        <Tabs.Label>
          <Text size="b4" className={isSelected ? 'text-main font-semibold' : 'text-gray-5'}>
            {t(REPORT_TYPE_LABEL_KEYS[type])}
          </Text>
        </Tabs.Label>
      )}
    </Tabs.Trigger>
  );
}

function FreeReportPreview() {
  const push = useSingleTap(router.push);
  const { t } = useTranslation('ai');
  const [reportType] = useReportTypeParam();
  const sampleReport = getSampleReport(SAMPLE_REPORT_IDS[reportType]);

  return (
    <VStack gap={12}>
      <Box className="opacity-60">
        <ReportCard report={sampleReport} isSample isLast />
      </Box>

      <Button size="medium" onPress={() => push('/settings/subscription')}>
        {t('report.list.subscribeCta')}
      </Button>
    </VStack>
  );
}

function ReportList() {
  const [reportType] = useReportTypeParam();
  usePrefetchQuery(useGetReportStatusQueryOptions());
  const { data: reports } = useSuspenseQuery(useGetReportsQueryOptions({ type: reportType }));

  if (reports.length === 0) {
    return <PremiumPendingPreview />;
  }

  return (
    <VStack gap={4}>
      {reports.map((report, index) => (
        <ReportCard key={report.id} report={report} isLast={index === reports.length - 1} />
      ))}
    </VStack>
  );
}

function PremiumPendingPreview() {
  const { t } = useTranslation('ai');
  const [reportType] = useReportTypeParam();
  const { data: status } = useSuspenseQuery(useGetReportStatusQueryOptions());
  const sampleReport = getSampleReport(SAMPLE_REPORT_IDS[reportType]);
  const daysUntil = match(reportType)
    .with('WEEKLY', () => status.daysUntilWeekly)
    .with('MONTHLY', () => status.daysUntilMonthly)
    .exhaustive();
  const reportLabel = t(REPORT_TYPE_LABEL_KEYS[reportType]);

  return (
    <VStack gap={12}>
      <Box className="opacity-60">
        <ReportCard report={sampleReport} isSample isLast />
      </Box>

      <Text size="b3" shade={7} align="center">
        {daysUntil === 0
          ? t('report.list.arrivalToday', { type: reportLabel })
          : t('report.list.arrivalInDays', { count: daysUntil, type: reportLabel })}
      </Text>
    </VStack>
  );
}

export default function ReportsRoute() {
  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <QueryErrorBoundary>
        <Suspense fallback={<ReportCard.Loading />}>
          <ReportsScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}

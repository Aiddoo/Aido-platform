import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { AiConsentNotice } from '@src/features/identity/consent/components/ai-consent-notice';
import {
  FreeReportPreview,
  ReportList,
} from '@src/features/insights/report/components/report-list';
import { ReportRow } from '@src/features/insights/report/components/report-row';
import { ReportStatusBanner } from '@src/features/insights/report/components/report-status-banner';
import { ReportsLoading } from '@src/features/insights/report/components/reports-loading';
import { REPORT_TYPE_LABEL_KEYS } from '@src/features/insights/report/constants/report-labels';
import { useReportTypeParam } from '@src/features/insights/report/hooks/use-report-type-param';
import { invalidateAiReports } from '@src/features/insights/report/queries/report-cache';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  H4,
  Image,
  QueryErrorBoundary,
  ScallopedContainer,
  SegmentTabTrigger,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { Tabs } from 'heroui-native';
import { Suspense } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

function ReportsScreen() {
  const { t } = useTranslation('ai');
  const queryClient = useQueryClient();
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const canViewReports = !EntitlementPolicy.isFeatureLocked(entitlements, 'AI_REPORT');
  const [reportType, setReportType] = useReportTypeParam();
  const [isRefreshing, handleRefresh] = useRefresh(() => invalidateAiReports(queryClient));
  const { color: refreshTint } = useResolveClassNames('text-main');

  return (
    <ScrollView
      className="flex-1 px-4"
      refreshControl={
        <RefreshControl
          refreshing={isRefreshing}
          onRefresh={handleRefresh}
          tintColor={refreshTint}
          colors={refreshTint == null ? undefined : [refreshTint]}
        />
      }
    >
      <StyledSafeAreaView edges={['left', 'right']}>
        <Spacing size={16} />

        <VStack gap={12}>
          {canViewReports && <AiConsentNotice title={t('consent.notice.reports')} />}

          <ScallopedContainer>
            <Box className="items-center px-5 pt-4">
              <Image
                source={require('@assets/images/ido_cat_suggestion.webp')}
                className="size-[100px]"
                contentFit="contain"
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
              <Tabs value={reportType} onValueChange={setReportType} variant="primary">
                <Tabs.List>
                  <Tabs.Indicator />
                  <SegmentTabTrigger value="WEEKLY">
                    {t(REPORT_TYPE_LABEL_KEYS.WEEKLY)}
                  </SegmentTabTrigger>
                  <SegmentTabTrigger value="MONTHLY">
                    {t(REPORT_TYPE_LABEL_KEYS.MONTHLY)}
                  </SegmentTabTrigger>
                </Tabs.List>
              </Tabs>
            </Box>

            <Spacing size={8} />

            <Box className="px-4 pb-4">
              {match(canViewReports)
                .with(true, () => (
                  <QueryErrorBoundary resetKeys={[reportType]}>
                    <Suspense fallback={<ReportRow.Loading />}>
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

export default function ReportsRoute() {
  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <QueryErrorBoundary>
        <Suspense fallback={<ReportsLoading />}>
          <ReportsScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}

import { EntitlementPolicy } from '@src/features/billing/subscription/domains/entitlement.model';
import { useGetEntitlementsQueryOptions } from '@src/features/billing/subscription/queries/entitlement.queries';
import { AiConsentNotice } from '@src/features/identity/consent/components/ai-consent-notice';
import {
  FreeReportPreview,
  ReportList,
} from '@src/features/insights/report/components/report-list';
import { ReportRow } from '@src/features/insights/report/components/report-row';
import { ReportStatusBanner } from '@src/features/insights/report/components/report-status-banner';
import { REPORT_TYPE_LABEL_KEYS } from '@src/features/insights/report/constants/report-labels';
import { useReportType } from '@src/features/insights/report/hooks/use-report-type';
import { invalidateAiReports } from '@src/features/insights/report/queries/report-cache';
import { reportListTypeSchema } from '@src/features/insights/report/schemas/report-params.schema';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  H4,
  Image,
  QueryErrorBoundary,
  QueryErrorFallback,
  ScallopedContainer,
  SegmentTabTrigger,
  Spacing,
  StyledSafeAreaView,
  Text,
  TextSkeleton,
  ViewTabs,
  VStack,
  TintedRefreshControl,
} from '@src/shared/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

export default function ReportsScreen() {
  const { t } = useTranslation('ai');
  const queryClient = useQueryClient();
  // 권한을 기다리느라 화면 전체가 막히지 않게 한다. 영속 캐시가 있으면 첫 렌더부터 값이 있다
  const entitlementsQuery = useQuery({ ...useGetEntitlementsQueryOptions(), throwOnError: false });
  const canViewReports =
    entitlementsQuery.data == null
      ? undefined
      : !EntitlementPolicy.isFeatureLocked(entitlementsQuery.data, 'AI_REPORT');
  const [reportType, setReportType] = useReportType();
  const [isRefreshing, handleRefresh] = useRefresh(() => invalidateAiReports(queryClient));

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <ScrollView
        className="flex-1 px-4"
        refreshControl={
          <TintedRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
        }
      >
        <StyledSafeAreaView edges={['left', 'right']}>
          <Spacing size={16} />

          <VStack gap={12}>
            {canViewReports === true && <AiConsentNotice title={t('consent.notice.reports')} />}

            <ScallopedContainer>
              <Box className="items-center px-5 pt-4">
                <Image
                  source={require('@assets/images/ido_cat_suggestion.webp')}
                  className="size-[100px]"
                  contentFit="contain"
                />
                <Spacing size={8} />
                {match(canViewReports)
                  .with(true, () => (
                    <>
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
                    </>
                  ))
                  .with(false, () => (
                    <>
                      <H4
                        align="center"
                        lineBreakStrategyIOS="hangul-word"
                        textBreakStrategy="highQuality"
                      >
                        {t('report.list.freeTitle')}
                      </H4>
                      <Text size="b4" shade={6} align="center">
                        {t('report.list.freeDescription')}
                      </Text>
                    </>
                  ))
                  .with(undefined, () => (
                    <>
                      <TextSkeleton size="t3" className="w-40" />
                      <TextSkeleton size="b4" className="w-56" />
                    </>
                  ))
                  .exhaustive()}
              </Box>

              <Spacing size={16} />

              {/* 프리미엄 사용자가 매번 보는 줄이라 권한을 기다리는 동안에도 자리를 잡는다 */}
              {match(canViewReports)
                .with(true, () => (
                  <Box className="px-4">
                    <QueryErrorBoundary>
                      <Suspense fallback={<ReportStatusBanner.Loading />}>
                        <ReportStatusBanner />
                      </Suspense>
                    </QueryErrorBoundary>
                  </Box>
                ))
                .with(undefined, () => (
                  <Box className="px-4">
                    <ReportStatusBanner.Loading />
                  </Box>
                ))
                .with(false, () => null)
                .exhaustive()}

              <Spacing size={12} />

              <Box className="px-4">
                <ViewTabs
                  schema={reportListTypeSchema}
                  value={reportType}
                  onValueChange={setReportType}
                  variant="primary"
                >
                  <Tabs.List>
                    <Tabs.Indicator />
                    <SegmentTabTrigger value="WEEKLY">
                      {t(REPORT_TYPE_LABEL_KEYS.WEEKLY)}
                    </SegmentTabTrigger>
                    <SegmentTabTrigger value="MONTHLY">
                      {t(REPORT_TYPE_LABEL_KEYS.MONTHLY)}
                    </SegmentTabTrigger>
                  </Tabs.List>
                </ViewTabs>
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
                  .with(undefined, () =>
                    entitlementsQuery.isError ? (
                      <QueryErrorFallback reset={() => entitlementsQuery.refetch()} />
                    ) : (
                      <ReportRow.Loading />
                    ),
                  )
                  .exhaustive()}
              </Box>
            </ScallopedContainer>
          </VStack>

          <Spacing size={32} />
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}

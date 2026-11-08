import { useFeatureAccess } from '@src/features/billing/subscription/hooks/use-feature-access';
import { AiConsentNotice } from '@src/features/identity/consent/components/ai-consent-notice';
import {
  FreeReportPreview,
  ReportList,
} from '@src/features/insights/report/components/report-list';
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
import { useQueryClient } from '@tanstack/react-query';
import { Tabs } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

export default function ReportsScreen() {
  const { t } = useTranslation('ai');
  const queryClient = useQueryClient();
  const featureAccess = useFeatureAccess('AI_REPORT');
  const [reportType, setReportType] = useReportType();
  const [isRefreshing, handleRefresh] = useRefresh(() => invalidateReports(queryClient));

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
            {featureAccess.status === 'premium' && (
              <AiConsentNotice title={t('consent.notice.reports')} />
            )}

            <ScallopedContainer>
              <Box className="items-center px-5 pt-4">
                <Image
                  source={require('@assets/images/ido_cat_suggestion.webp')}
                  className="size-[100px]"
                  contentFit="contain"
                />
                <Spacing size={8} />
                {match(featureAccess.status)
                  .with('premium', () => (
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
                  .with('free', () => (
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
                  .with('loading', () => (
                    <>
                      <TextSkeleton size="t3" className="w-40" />
                      <TextSkeleton size="b4" className="w-56" />
                    </>
                  ))
                  .with('error', () => null)
                  .exhaustive()}
              </Box>

              <Spacing size={16} />

              {/* 프리미엄 사용자가 매번 보는 줄이라 권한을 기다리는 동안에도 자리를 잡는다 */}
              {match(featureAccess.status)
                .with('premium', () => (
                  <Box className="px-4">
                    <QueryErrorBoundary>
                      <Suspense fallback={<ReportStatusBanner.Loading />}>
                        <ReportStatusBanner />
                      </Suspense>
                    </QueryErrorBoundary>
                  </Box>
                ))
                .with('loading', () => (
                  <Box className="px-4">
                    <ReportStatusBanner.Loading />
                  </Box>
                ))
                .with('free', 'error', () => null)
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
                {match(featureAccess.status)
                  .with('premium', () => (
                    <QueryErrorBoundary resetKeys={[reportType]}>
                      <Suspense fallback={<ReportList.Loading />}>
                        <ReportList />
                      </Suspense>
                    </QueryErrorBoundary>
                  ))
                  .with('free', () => <FreeReportPreview />)
                  .with('loading', () => <ReportList.Loading />)
                  .with('error', () => <QueryErrorFallback reset={() => featureAccess.refetch()} />)
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

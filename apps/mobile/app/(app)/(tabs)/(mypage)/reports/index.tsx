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
  QueryErrorBoundary,
  QueryErrorFallback,
  ScallopedContainer,
  SegmentTabTrigger,
  Spacing,
  SafeAreaScrollView,
  Text,
  TextSkeleton,
  ViewTabs,
  VStack,
  TintedRefreshControl,
  Mascot,
} from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { Tabs } from 'heroui-native';
import { type ReactNode, Suspense } from 'react';
import { match } from 'ts-pattern';

export default function ReportsScreen() {
  const queryClient = useQueryClient();
  const featureAccess = useFeatureAccess('AI_REPORT');
  const [isRefreshing, handleRefresh] = useRefresh(() => invalidateReports(queryClient));

  return (
    <SafeAreaScrollView
      className="flex-1 bg-white px-4"
      refreshControl={<TintedRefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />}
    >
      <Spacing size={16} />

      {match(featureAccess.status)
        .with('premium', () => <ReportsPanel.Premium />)
        .with('free', () => <ReportsPanel.Free />)
        .with('loading', () => <ReportsPanel.Loading />)
        .with('error', () => <ReportsPanel.Error />)
        .exhaustive()}

      <Spacing size={32} />
    </SafeAreaScrollView>
  );
}

interface ReportsPanelProps {
  heading: ReactNode;
  banner: ReactNode;
  list: ReactNode;
}

function ReportsPanel({ heading, banner, list }: ReportsPanelProps) {
  return (
    <ScallopedContainer>
      <Box className="items-center px-5 pt-4">
        <Mascot name="catSuggestion" size={100} />
        <Spacing size={8} />
        {heading}
      </Box>

      <Spacing size={16} />

      {banner}

      <Spacing size={12} />

      <ReportTypeTabs />

      <Spacing size={8} />

      <Box className="px-4 pb-4">{list}</Box>
    </ScallopedContainer>
  );
}

ReportsPanel.Premium = function Premium() {
  const { t } = useTranslation('ai');
  const [reportType] = useReportType();

  return (
    <VStack gap={12}>
      <AiConsentNotice title={t('consent.notice.reports')} />

      <ReportsPanel
        heading={
          <ReportHeading
            title={t('report.list.premiumTitle')}
            description={t('report.list.premiumDescription')}
          />
        }
        banner={
          <Box className="px-4">
            <QueryErrorBoundary>
              <Suspense fallback={<ReportStatusBanner.Loading />}>
                <ReportStatusBanner />
              </Suspense>
            </QueryErrorBoundary>
          </Box>
        }
        list={
          <QueryErrorBoundary resetKeys={[reportType]}>
            <Suspense fallback={<ReportList.Loading />}>
              <ReportList />
            </Suspense>
          </QueryErrorBoundary>
        }
      />
    </VStack>
  );
};

ReportsPanel.Free = function Free() {
  const { t } = useTranslation('ai');

  return (
    <ReportsPanel
      heading={
        <ReportHeading
          title={t('report.list.freeTitle')}
          description={t('report.list.freeDescription')}
        />
      }
      banner={null}
      list={<ReportList.Free />}
    />
  );
};

/** 프리미엄 사용자가 매번 보는 화면이라 권한을 기다리는 동안에도 같은 자리를 잡는다 */
ReportsPanel.Loading = function Loading() {
  return (
    <ReportsPanel
      heading={
        <>
          <TextSkeleton size="t3" className="w-40" />
          <TextSkeleton size="b4" className="w-56" />
        </>
      }
      banner={
        <Box className="px-4">
          <ReportStatusBanner.Loading />
        </Box>
      }
      list={<ReportList.Loading />}
    />
  );
};

ReportsPanel.Error = function ErrorFallback() {
  const featureAccess = useFeatureAccess('AI_REPORT');

  return (
    <ReportsPanel
      heading={null}
      banner={null}
      list={<QueryErrorFallback reset={() => featureAccess.refetch()} />}
    />
  );
};

function ReportHeading({ title, description }: { title: string; description: string }) {
  return (
    <>
      <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
        {title}
      </H4>
      <Text size="b4" shade={6} align="center">
        {description}
      </Text>
    </>
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

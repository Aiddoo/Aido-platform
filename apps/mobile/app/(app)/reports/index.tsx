import { reportTypeSchema } from '@aido/api';
import { ReportCard } from '@src/features/ai/components/report-card';
import { ReportStatusBanner } from '@src/features/ai/components/report-status-banner';
import { ScallopedContainer } from '@src/features/ai/components/scalloped-container';
import { getSampleReport } from '@src/features/ai/constants/sample-reports';
import { invalidateAiReports } from '@src/features/ai/queries/ai-cache';
import { useGetReportStatusQueryOptions } from '@src/features/ai/queries/get-report-status-query-options';
import { useGetReportsQueryOptions } from '@src/features/ai/queries/get-reports-query-options';
import { UserPolicy } from '@src/features/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
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
} from '@src/shared/ui';
import { useQueryClient, useSuspenseQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { Tabs } from 'heroui-native';
import { Suspense, useCallback } from 'react';
import { Image, RefreshControl, ScrollView, View } from 'react-native';
import { match } from 'ts-pattern';
import type { z } from 'zod';

type ReportType = z.infer<typeof reportTypeSchema>;

const REPORT_TYPE_LABEL_KEYS = {
  WEEKLY: 'report.typeWeekly',
  MONTHLY: 'report.typeMonthly',
} as const satisfies Record<ReportType, string>;

const SAMPLE_REPORT_IDS = {
  WEEKLY: 'sample-weekly',
  MONTHLY: 'sample-monthly',
} as const satisfies Record<ReportType, string>;

function useReportType() {
  const { type } = useLocalSearchParams();
  const setType = useCallback((next: ReportType) => router.setParams({ type: next }), []);

  return [reportTypeSchema.catch('WEEKLY').parse(type), setType] as const;
}

function ReportsScreen() {
  const { t } = useTranslation('ai');
  const queryClient = useQueryClient();
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const isPremium = UserPolicy.isPremiumUser(user);
  const [reportType, setReportType] = useReportType();
  const [refreshing, onRefresh] = useRefresh(() => invalidateAiReports(queryClient));

  return (
    <ScrollView
      className="flex-1 px-4"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
    >
      <Spacing size={16} />

      <ScallopedContainer>
        <View className="items-center px-5 pt-4">
          <Image
            source={require('@assets/images/ido_cat_suggestion.webp')}
            style={{ width: 100, height: 100 }}
            resizeMode="contain"
          />
          <Spacing size={8} />
          <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
            {isPremium ? t('report.list.premiumTitle') : t('report.list.freeTitle')}
          </H4>
          <Text size="b4" shade={6} align="center">
            {isPremium ? t('report.list.premiumDescription') : t('report.list.freeDescription')}
          </Text>
        </View>

        <Spacing size={16} />

        {isPremium && (
          <View className="px-4">
            <QueryErrorBoundary>
              <Suspense fallback={<ReportStatusBanner.Loading />}>
                <ReportStatusBanner />
              </Suspense>
            </QueryErrorBoundary>
          </View>
        )}

        <Spacing size={12} />

        <View className="px-4">
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
        </View>

        <Spacing size={8} />

        <View className="px-4 pb-4">
          {match(isPremium)
            .with(true, () => (
              <QueryErrorBoundary resetKeys={[reportType]}>
                <Suspense fallback={<ReportCard.Loading />}>
                  <ReportList />
                </Suspense>
              </QueryErrorBoundary>
            ))
            .with(false, () => <FreeReportPreview />)
            .exhaustive()}
        </View>
      </ScallopedContainer>

      <Spacing size={32} />
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
  const [reportType] = useReportType();
  const sampleReport = getSampleReport(SAMPLE_REPORT_IDS[reportType]);

  return (
    <VStack gap={12}>
      <View className="opacity-60">
        <ReportCard report={sampleReport} isSample isLast />
      </View>

      <Button size="medium" onPress={() => push('/settings/subscription')}>
        {t('report.list.subscribeCta')}
      </Button>
    </VStack>
  );
}

function ReportList() {
  const [reportType] = useReportType();
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
  const [reportType] = useReportType();
  const { data: status } = useSuspenseQuery(useGetReportStatusQueryOptions());
  const sampleReport = getSampleReport(SAMPLE_REPORT_IDS[reportType]);
  const daysUntil = match(reportType)
    .with('WEEKLY', () => status.daysUntilWeekly)
    .with('MONTHLY', () => status.daysUntilMonthly)
    .exhaustive();
  const reportLabel = t(REPORT_TYPE_LABEL_KEYS[reportType]);

  return (
    <VStack gap={12}>
      <View className="opacity-60">
        <ReportCard report={sampleReport} isSample isLast />
      </View>

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
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <QueryErrorBoundary>
        <Suspense fallback={<ReportCard.Loading />}>
          <ReportsScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}

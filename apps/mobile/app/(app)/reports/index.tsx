import { reportTypeSchema } from '@aido/api';
import { ReportCard } from '@src/features/ai/components/report-card';
import { ReportStatusBanner } from '@src/features/ai/components/report-status-banner';
import { ScallopedContainer } from '@src/features/ai/components/scalloped-container';
import { AI_QUERY_KEYS } from '@src/features/ai/constants/ai-query-keys';
import { getSampleReport } from '@src/features/ai/constants/sample-reports';
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
import { router } from 'expo-router';
import { Tabs } from 'heroui-native';
import { Suspense, useState } from 'react';
import { Image, RefreshControl, ScrollView, View } from 'react-native';
import { match } from 'ts-pattern';
import type { z } from 'zod';

type ReportType = z.infer<typeof reportTypeSchema>;

function ReportsScreen() {
  const { t } = useTranslation('ai');
  const queryClient = useQueryClient();
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const isPremium = UserPolicy.isPremiumUser(user);
  const [activeTab, setActiveTab] = useState<ReportType>('WEEKLY');
  const [refreshing, onRefresh] = useRefresh(() =>
    queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.all }),
  );

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
            value={activeTab}
            onValueChange={(value) => {
              const parsed = reportTypeSchema.safeParse(value);
              if (parsed.success) {
                setActiveTab(parsed.data);
              }
            }}
            variant="primary"
          >
            <Tabs.List>
              <Tabs.Indicator />
              <Tabs.Trigger value="WEEKLY">
                {({ isSelected }) => (
                  <Tabs.Label>
                    <Text
                      size="b4"
                      className={isSelected ? 'text-main font-semibold' : 'text-gray-5'}
                    >
                      {t('report.typeWeekly')}
                    </Text>
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
              <Tabs.Trigger value="MONTHLY">
                {({ isSelected }) => (
                  <Tabs.Label>
                    <Text
                      size="b4"
                      className={isSelected ? 'text-main font-semibold' : 'text-gray-5'}
                    >
                      {t('report.typeMonthly')}
                    </Text>
                  </Tabs.Label>
                )}
              </Tabs.Trigger>
            </Tabs.List>
          </Tabs>
        </View>

        <Spacing size={8} />

        <View className="px-4 pb-4">
          {match(isPremium)
            .with(true, () => (
              <QueryErrorBoundary resetKeys={[activeTab]}>
                <Suspense fallback={<ReportCard.Loading />}>
                  <ReportList type={activeTab} />
                </Suspense>
              </QueryErrorBoundary>
            ))
            .with(false, () => <FreeReportPreview type={activeTab} />)
            .exhaustive()}
        </View>
      </ScallopedContainer>

      <Spacing size={32} />
    </ScrollView>
  );
}

function FreeReportPreview({ type }: { type: ReportType }) {
  const push = useSingleTap(router.push);

  const { t } = useTranslation('ai');
  const sampleReport = getSampleReport(`sample-${type.toLowerCase()}`);

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

function ReportList({ type }: { type: ReportType }) {
  const { data: reports } = useSuspenseQuery(useGetReportsQueryOptions({ type }));

  if (reports.length === 0) {
    return <PremiumPendingPreview type={type} />;
  }

  return (
    <VStack gap={4}>
      {reports.map((report, index) => (
        <ReportCard key={report.id} report={report} isLast={index === reports.length - 1} />
      ))}
    </VStack>
  );
}

function PremiumPendingPreview({ type }: { type: ReportType }) {
  const { t } = useTranslation('ai');
  const { data: status } = useSuspenseQuery(useGetReportStatusQueryOptions());
  const sampleReport = getSampleReport(`sample-${type.toLowerCase()}`);

  const daysUntil = type === 'WEEKLY' ? status.daysUntilWeekly : status.daysUntilMonthly;
  const reportLabel = type === 'WEEKLY' ? t('report.typeWeekly') : t('report.typeMonthly');

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

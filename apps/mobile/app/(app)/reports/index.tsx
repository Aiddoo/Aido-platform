import { ReportCard } from '@src/features/ai/presentations/components/ReportCard';
import { ReportStatusBanner } from '@src/features/ai/presentations/components/ReportStatusBanner';
import { ScallopedContainer } from '@src/features/ai/presentations/components/ScallopedContainer';
import { AI_QUERY_KEYS } from '@src/features/ai/presentations/constants/ai-query-keys.constant';
import { getSampleReport } from '@src/features/ai/presentations/constants/sample-reports.constant';
import { useGetReportStatusQueryOptions } from '@src/features/ai/presentations/queries/use-get-report-status-query-options';
import { useGetReportsQueryOptions } from '@src/features/ai/presentations/queries/use-get-reports-query-options';
import { UserPolicy } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
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
import { useRouter } from 'expo-router';
import { Tabs } from 'heroui-native';
import { Suspense, useCallback, useState } from 'react';
import { Image, RefreshControl, ScrollView, View } from 'react-native';

type ReportType = 'WEEKLY' | 'MONTHLY';

const ReportsScreen = () => {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <QueryErrorBoundary>
        <Suspense fallback={<ReportCard.Loading />}>
          <ReportsContent />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
};

export default ReportsScreen;

function ReportsContent() {
  const { t } = useTranslation('ai');
  const queryClient = useQueryClient();
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const isPremium = UserPolicy.isPremiumUser(user);
  const [activeTab, setActiveTab] = useState<ReportType>('WEEKLY');
  const [refreshing, setRefreshing] = useState(false);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: AI_QUERY_KEYS.all });
    setRefreshing(false);
  }, [queryClient]);

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
          <ReportTypeTabs value={activeTab} onValueChange={setActiveTab} />
        </View>

        <Spacing size={8} />

        <View className="px-4 pb-4">
          {isPremium && (
            <QueryErrorBoundary>
              <Suspense fallback={<ReportCard.Loading />}>
                <ReportList type={activeTab} />
              </Suspense>
            </QueryErrorBoundary>
          )}

          {!isPremium && <FreeReportPreview type={activeTab} />}
        </View>
      </ScallopedContainer>

      <Spacing size={32} />
    </ScrollView>
  );
}

function ReportTypeTabs({
  value,
  onValueChange,
}: {
  value: ReportType;
  onValueChange: (v: ReportType) => void;
}) {
  const { t } = useTranslation('ai');

  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as ReportType)} variant="primary">
      <Tabs.List>
        <Tabs.Indicator />
        <Tabs.Trigger value="WEEKLY">
          {({ isSelected }) => (
            <Tabs.Label>
              <Text size="b4" className={isSelected ? 'text-main font-semibold' : 'text-gray-5'}>
                {t('report.typeWeekly')}
              </Text>
            </Tabs.Label>
          )}
        </Tabs.Trigger>
        <Tabs.Trigger value="MONTHLY">
          {({ isSelected }) => (
            <Tabs.Label>
              <Text size="b4" className={isSelected ? 'text-main font-semibold' : 'text-gray-5'}>
                {t('report.typeMonthly')}
              </Text>
            </Tabs.Label>
          )}
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs>
  );
}

function FreeReportPreview({ type }: { type: ReportType }) {
  const { t } = useTranslation('ai');
  const router = useRouter();
  const sampleReport = getSampleReport(`sample-${type.toLowerCase()}`);

  return (
    <VStack gap={12}>
      <View className="opacity-60">
        <ReportCard report={sampleReport} isSample isLast />
      </View>

      <Button size="medium" onPress={() => router.push('/settings/subscription')}>
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

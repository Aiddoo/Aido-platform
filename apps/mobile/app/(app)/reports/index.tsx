import { ReportCard } from '@src/features/ai/presentations/components/ReportCard';
import { ReportStatusBanner } from '@src/features/ai/presentations/components/ReportStatusBanner';
import { ScallopedContainer } from '@src/features/ai/presentations/components/ScallopedContainer';
import { AI_QUERY_KEYS } from '@src/features/ai/presentations/constants/ai-query-keys.constant';
import { getSampleReport } from '@src/features/ai/presentations/constants/sample-reports.constant';
import { useGetReportsQueryOptions } from '@src/features/ai/presentations/queries/use-get-reports-query-options';
import { UserPolicy } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import {
  Box,
  Button,
  DocsIcon,
  H4,
  QueryErrorBoundary,
  Result,
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
          <H4>{isPremium ? 'AI 리포트' : 'AI가 분석한 나만의 리포트'}</H4>
          <Text size="b4" shade={6} align="center">
            {isPremium
              ? '할 일 데이터를 분석해서 리포트를 만들어드려요'
              : '프리미엄 구독으로 매주/매월 AI 리포트를 받아보세요'}
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
  return (
    <Tabs value={value} onValueChange={(v) => onValueChange(v as ReportType)} variant="primary">
      <Tabs.List>
        <Tabs.Indicator />
        <Tabs.Trigger value="WEEKLY">
          <Tabs.Label className="text-b4">주간</Tabs.Label>
        </Tabs.Trigger>
        <Tabs.Trigger value="MONTHLY">
          <Tabs.Label className="text-b4">월간</Tabs.Label>
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs>
  );
}

function FreeReportPreview({ type }: { type: ReportType }) {
  const router = useRouter();
  const sampleReport = getSampleReport(`sample-${type.toLowerCase()}`);

  return (
    <VStack gap={12}>
      <View className="opacity-60">
        <ReportCard report={sampleReport} isSample isLast />
      </View>

      <Button size="medium" onPress={() => router.push('/settings/subscription')}>
        구독하고 리포트 받기
      </Button>
    </VStack>
  );
}

function ReportList({ type }: { type: ReportType }) {
  const { data: reports } = useSuspenseQuery(useGetReportsQueryOptions({ type }));

  if (reports.length === 0) {
    return (
      <Box my={32}>
        <Result
          icon={<DocsIcon width={48} height={48} />}
          title="아직 리포트가 없어요"
          description="할 일을 완료하면 AI가 리포트를 생성해줘요"
        />
      </Box>
    );
  }

  return (
    <VStack gap={4}>
      {reports.map((report, index) => (
        <ReportCard key={report.id} report={report} isLast={index === reports.length - 1} />
      ))}
    </VStack>
  );
}

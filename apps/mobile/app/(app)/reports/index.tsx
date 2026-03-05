import { ReportCard } from '@src/features/ai/presentations/components/ReportCard';
import { ReportPremiumBanner } from '@src/features/ai/presentations/components/ReportPremiumBanner';
import { ReportStatusBanner } from '@src/features/ai/presentations/components/ReportStatusBanner';
import { getSampleReport } from '@src/features/ai/presentations/constants/sample-reports.constant';
import { getReportsQueryOptions } from '@src/features/ai/presentations/queries/get-reports-query-options';
import { UserPolicy } from '@src/features/user/models/user.model';
import { getMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { DocsIcon } from '@src/shared/ui/Icon';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { Result } from '@src/shared/ui/Result/Result';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Tabs } from 'heroui-native';
import { Suspense, useState } from 'react';
import { ScrollView } from 'react-native';

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
  const { data: user } = useSuspenseQuery(getMeQueryOptions());
  const isPremium = UserPolicy.isPremiumUser(user);
  const [activeTab, setActiveTab] = useState<ReportType>('WEEKLY');

  return (
    <ScrollView className="flex-1 px-4">
      <Spacing size={16} />

      {isPremium && (
        <QueryErrorBoundary>
          <Suspense fallback={<ReportStatusBanner.Loading />}>
            <ReportStatusBanner />
          </Suspense>
        </QueryErrorBoundary>
      )}
      {!isPremium && <ReportPremiumBanner />}

      <Spacing size={16} />

      <ReportTypeTabs value={activeTab} onValueChange={setActiveTab} />

      <Spacing size={12} />

      {isPremium && (
        <QueryErrorBoundary>
          <Suspense fallback={<ReportCard.Loading />}>
            <ReportList type={activeTab} />
          </Suspense>
        </QueryErrorBoundary>
      )}

      {!isPremium && <FreeReportPreview type={activeTab} />}

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
          <Tabs.Label>주간</Tabs.Label>
        </Tabs.Trigger>
        <Tabs.Trigger value="MONTHLY">
          <Tabs.Label>월간</Tabs.Label>
        </Tabs.Trigger>
      </Tabs.List>
    </Tabs>
  );
}

function FreeReportPreview({ type }: { type: ReportType }) {
  const sampleReport = getSampleReport(`sample-${type.toLowerCase()}`);

  return (
    <VStack gap={8}>
      <Text size="b4" shade={6}>
        이런 리포트를 받을 수 있어요
      </Text>
      <ReportCard report={sampleReport} isSample />
    </VStack>
  );
}

function ReportList({ type }: { type: ReportType }) {
  const { data: reports } = useSuspenseQuery(getReportsQueryOptions({ type }));

  if (reports.length === 0) {
    return (
      <Result
        icon={<DocsIcon width={72} height={72} />}
        title="아직 리포트가 없어요"
        description="할 일을 완료하면 AI가 리포트를 생성해줘요"
      />
    );
  }

  return (
    <VStack gap={12}>
      {reports.map((report) => (
        <ReportCard key={report.id} report={report} />
      ))}
    </VStack>
  );
}

import type { AiReport } from '@src/features/ai/models/ai.model';
import { ReportDetailContent } from '@src/features/ai/presentations/components/ReportDetailContent';
import {
  getSampleReport,
  isSampleReportId,
} from '@src/features/ai/presentations/constants/sample-reports.constant';
import { useGetReportDetailQueryOptions } from '@src/features/ai/presentations/queries/use-get-report-detail-query-options';
import { Button } from '@src/shared/ui/Button/Button';
import { usePremiumDialog } from '@src/shared/ui/PremiumDialog/PremiumDialog';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing';
import { Text } from '@src/shared/ui/Text';
import { VStack } from '@src/shared/ui/VStack';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { Card } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

const ReportDetailScreen = () => {
  const { id } = useLocalSearchParams<{ id: string }>();

  if (!id) {
    return null;
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      {isSampleReportId(id) ? (
        <SampleReportDetail report={getSampleReport(id)} />
      ) : (
        <QueryErrorBoundary>
          <Suspense fallback={<ReportDetailContent.Loading />}>
            <ReportDetailBody id={Number(id)} />
          </Suspense>
        </QueryErrorBoundary>
      )}
    </StyledSafeAreaView>
  );
};

export default ReportDetailScreen;

function ReportDetailBody({ id }: { id: number }) {
  const { data: report } = useSuspenseQuery(useGetReportDetailQueryOptions(id));

  return (
    <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
      <Spacing size={16} />
      <ReportDetailContent report={report} />
    </ScrollView>
  );
}

function SampleReportDetail({ report }: { report: AiReport }) {
  const premiumDialog = usePremiumDialog();

  return (
    <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
      <Spacing size={16} />
      <ReportDetailContent report={report} />

      <Card className="border border-main bg-main/5 dark:bg-main/10">
        <VStack gap={8} align="center">
          <Text size="b3" weight="bold" shade={9}>
            나만의 리포트를 받아보세요
          </Text>
          <Text size="b4" shade={6} className="text-center">
            {'프리미엄 구독으로 매주/매월\nAI가 분석한 리포트를 보내드려요'}
          </Text>
          <Spacing size={4} />
          <Button
            size="medium"
            onPress={() =>
              premiumDialog.open({
                description: 'AI 리포트는 프리미엄 구독자만 이용할 수 있어요.',
              })
            }
          >
            프리미엄 구독하기
          </Button>
        </VStack>
      </Card>
      <Spacing size={32} />
    </ScrollView>
  );
}

import type { AiReport } from '@src/features/ai/models/ai.model';
import { ReportDetailContent } from '@src/features/ai/presentations/components/ReportDetailContent';
import {
  getSampleReport,
  isSampleReportId,
} from '@src/features/ai/presentations/constants/sample-reports.constant';
import { useGetReportDetailQueryOptions } from '@src/features/ai/presentations/queries/use-get-report-detail-query-options';
import {
  Button,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  Text,
  usePremiumDialog,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
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
    <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8 pt-2">
      <ReportDetailContent report={report} />

      <Spacing size={32} />

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

      <Spacing size={24} />
    </ScrollView>
  );
}

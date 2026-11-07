import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { ActivityReport } from '@src/features/insights/report/components/activity-report';
import { SavedActivityReport } from '@src/features/insights/report/components/saved-activity-report';
import { getSampleReport } from '@src/features/insights/report/constants/sample-reports';
import { reportParamsSchema } from '@src/features/insights/report/schemas/report-params.schema';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { Redirect, useLocalSearchParams } from 'expo-router';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';
import { match } from 'ts-pattern';

export default function ReportDetailScreen() {
  const params = reportParamsSchema.safeParse(useLocalSearchParams());
  const { t } = useTranslation('ai');
  const gate = useEntitlementGate('AI_REPORT', { surface: 'report_detail' });

  if (!params.success) {
    return <Redirect href="/reports" />;
  }

  return (
    <StyledSafeAreaView className="flex-1 bg-white" edges={['bottom']}>
      <ScrollView className="flex-1 px-4" contentContainerClassName="grow pb-8">
        <StyledSafeAreaView edges={['left', 'right']} className="grow">
          {match(params.data.reportId)
            .with({ kind: 'sample' }, ({ id }) => (
              <>
                <Spacing size={8} />

                <ActivityReport report={getSampleReport(id)} />

                <Spacing size={32} />

                <VStack gap={8} align="center">
                  <Text size="b3" weight="bold" shade={9}>
                    {t('report.lockedDetail.title')}
                  </Text>
                  <Text size="b4" shade={6} className="text-center">
                    {t('report.lockedDetail.description')}
                  </Text>
                  <Spacing size={4} />
                  <Button size="medium" onPress={() => gate.guard()}>
                    {t('report.lockedDetail.subscribe')}
                  </Button>
                </VStack>

                <Spacing size={24} />
              </>
            ))
            .with({ kind: 'saved' }, ({ id }) => (
              <>
                <Spacing size={16} />

                <QueryErrorBoundary resetKeys={[id]} fallback={ActivityReport.Error}>
                  <Suspense fallback={<ActivityReport.Loading />}>
                    <SavedActivityReport />
                  </Suspense>
                </QueryErrorBoundary>
              </>
            ))
            .exhaustive()}
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}

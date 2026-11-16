import { useFeatureAccess } from '@src/features/billing/subscription/hooks/use-feature-access';
import { ActivityReport } from '@src/features/insights/report/components/activity-report';
import { SampleActivityReport } from '@src/features/insights/report/components/sample-activity-report';
import { sampleReportParamsSchema } from '@src/features/insights/report/schemas/report-params.schema';
import { useRouteParamsOrRedirect } from '@src/shared/hooks/use-route-params-or-redirect';
import { useTranslation } from '@src/shared/i18n';
import {
  InlineAlert,
  LabelChip,
  QueryErrorBoundary,
  ReadableContent,
  SafeAreaScrollView,
  Spacing,
} from '@src/shared/ui';
import { Redirect, Stack } from 'expo-router';
import { Suspense } from 'react';
import { match } from 'ts-pattern';

export default function SampleReportRoute() {
  const route = useRouteParamsOrRedirect(sampleReportParamsSchema, { fallbackHref: '/reports' });

  if (route.redirect != null) {
    return route.redirect;
  }

  return <SampleReportScreen />;
}

function SampleReportScreen() {
  const { t } = useTranslation('ai');
  const featureAccess = useFeatureAccess('AI_REPORT');

  return (
    <>
      <Stack.Screen options={{ title: t('report.sample.title') }} />

      <SafeAreaScrollView className="flex-1 bg-white" contentContainerClassName="grow">
        <ReadableContent className="grow px-4 pb-8">
          <Spacing size={16} />

          <InlineAlert
            image={
              <LabelChip color="warning" label={t('report.sample.badge')} pointerEvents="none" />
            }
            title={t('report.sample.noticeTitle')}
            description={t('report.sample.noticeDescription')}
            testID="report-sample-notice"
          />

          <Spacing size={12} />

          {match(featureAccess.status)
            .with('free', () => (
              <>
                <QueryErrorBoundary fallback={SampleActivityReport.Error}>
                  <Suspense fallback={<ActivityReport.Loading />}>
                    <SampleActivityReport />
                  </Suspense>
                </QueryErrorBoundary>

                <Spacing size={24} />

                <SampleActivityReport.SubscribeButton />
              </>
            ))
            // 예시는 무료 화면에서만 연다. 결제하고 돌아오거나 링크로 온 프리미엄은 내 리포트 목록으로 보낸다
            .with('premium', () => <Redirect href="/reports" />)
            .with('loading', () => <ActivityReport.Loading />)
            .with('error', () => (
              <SampleActivityReport.Error
                error={featureAccess.error}
                reset={() => featureAccess.refetch()}
              />
            ))
            .exhaustive()}
        </ReadableContent>
      </SafeAreaScrollView>
    </>
  );
}

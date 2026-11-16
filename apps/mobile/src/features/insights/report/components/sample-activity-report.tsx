import { getPremiumGateAnalyticsFeature } from '@src/features/billing/subscription/utils/subscription-analytics';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { useTrack, useTrackView } from '@src/shared/analytics';
import { useLocaleContext } from '@src/shared/hooks/use-locale-context';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTodayKey } from '@src/shared/hooks/use-today';
import { useTranslation } from '@src/shared/i18n';
import { Button, QueryErrorFallback, type QueryErrorFallbackProps } from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';

import { sampleReportParamsSchema } from '../schemas/report-params.schema';
import type { ReportVisibility } from '../utils/report-visibility.view-model';
import { createSampleReport } from '../utils/sample-report.view-model';
import { ActivityReport } from './activity-report';

interface SampleActivityReportProps {
  visibility: ReportVisibility;
}

/** 예시 값을 실제 리포트와 같은 영수증에 그린다. 예시라 차트를 눌러도 지표를 남기지 않는다 */
export function SampleActivityReport({ visibility }: SampleActivityReportProps) {
  const { language } = useLocaleContext();
  const [{ type, periodsAgo }] = useRouteParams(sampleReportParamsSchema);

  const { data: preference } = useSuspenseQuery(useGetPreferenceQueryOptions());
  const todayKey = useTodayKey();

  return (
    <ActivityReport.Receipt
      report={createSampleReport(type, periodsAgo, { todayKey, language })}
      visibility={visibility}
      timeFormat={preference.timeFormat}
    />
  );
}

/** 가린 예시 아래의 결제 버튼. 보이면 premium_gate_shown, 누르면 premium_gate_cta_tapped를 남기고 페이월을 연다 */
SampleActivityReport.SubscribeButton = function SubscribeButton() {
  const { t } = useTranslation('ai');
  const { trackEvent } = useTrack();
  const push = useSingleTap(router.push);
  const gateParams = {
    feature: getPremiumGateAnalyticsFeature('AI_REPORT'),
    surface: 'report_sample',
    presentation: 'inline',
  } as const;

  useTrackView('premium_gate_shown', { key: gateParams.feature, params: gateParams });

  const handlePress = () => {
    trackEvent('premium_gate_cta_tapped', gateParams);
    push({ pathname: '/paywall', params: { feature: 'AI_REPORT' } });
  };

  return (
    <Button size="medium" testID="report-sample-subscribe" onPress={handlePress}>
      {t('report.list.subscribeCta')}
    </Button>
  );
};

SampleActivityReport.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return <QueryErrorFallback reset={reset} />;
};

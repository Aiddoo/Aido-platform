import { PREMIUM_TRIAL_ENDING_NOTICE_DAYS } from '@aido/api/vocabulary';
import { useTrack } from '@src/shared/analytics';
import { formatDateKeyLabel } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { Box, HStack, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { type ComponentProps, useEffect, useRef } from 'react';

import { PLAN_PRICE_LABEL_KEYS } from '../constants/subscription-labels';
import { SubscriptionPolicy } from '../domains/subscription.model';
import { useGetOfferingsQueryOptions } from '../queries/subscription.queries';

interface TrialTimelineProps extends Omit<ComponentProps<typeof VStack>, 'children'> {
  planId: string | undefined;
}

/**
 * 체험을 줄 수 있는 요금제를 골랐을 때 결제까지의 날짜를 보여 준다(App Store 3.1.2: 체험 기간·뒤 금액·해지).
 * 날짜는 결제 전 예상이고, 결제 뒤 실제 날짜는 서버가 준 영수증이 보여 준다
 */
export function TrialTimeline({ planId, className, ...props }: TrialTimelineProps) {
  const { t } = useTranslation('subscription');
  const { data: availability } = useSuspenseQuery(useGetOfferingsQueryOptions());
  const { currentLocalDateKey } = useLocalDate();
  const dateFormatContext = useDateFormatContext();
  const { trackEvent } = useTrack();
  const hasTrackedRef = useRef(false);
  const plan =
    availability.status === 'available'
      ? SubscriptionPolicy.findSelectedPlan(availability.offering, planId)
      : null;
  const endDateKey =
    plan == null ? null : SubscriptionPolicy.getFreeTrialEndDateKey(plan, currentLocalDateKey);
  const visiblePlanType = endDateKey == null ? null : (plan?.planType ?? null);

  // 요금제를 오가며 다시 보여도 페이월을 본 한 번만 센다
  useEffect(() => {
    if (visiblePlanType == null || hasTrackedRef.current) {
      return;
    }
    hasTrackedRef.current = true;
    trackEvent('trial_timeline_viewed', { plan_type: visiblePlanType });
  }, [trackEvent, visiblePlanType]);

  if (plan == null || endDateKey == null) {
    return null;
  }
  const reminderDateKey = SubscriptionPolicy.getFreeTrialReminderDateKey(plan, currentLocalDateKey);
  const formatDate = (dateKey: string) =>
    formatDateKeyLabel(dateKey, 'monthDay', dateFormatContext);

  return (
    <VStack
      gap={8}
      className={cn('rounded-2xl bg-main/5 px-4 py-3', className)}
      testID="subscription-trial-timeline"
      {...props}
    >
      <Text size="b4" weight="semibold" shade={8}>
        {t('trialTimeline.title')}
      </Text>

      <VStack>
        <TimelineStep date={t('trialTimeline.today')} title={t('trialTimeline.start')} />
        {reminderDateKey != null && (
          <TimelineStep
            date={formatDate(reminderDateKey)}
            title={t('trialTimeline.reminder', { days: PREMIUM_TRIAL_ENDING_NOTICE_DAYS })}
          />
        )}
        <TimelineStep
          date={formatDate(endDateKey)}
          title={t('trialTimeline.charge', {
            price: t(PLAN_PRICE_LABEL_KEYS[plan.planType], { price: plan.priceString }),
          })}
          hint={t('trialTimeline.chargeHint')}
          isLast
        />
      </VStack>
    </VStack>
  );
}

interface TimelineStepProps {
  date: string;
  title: string;
  hint?: string;
  isLast?: boolean;
}

function TimelineStep({ date, title, hint, isLast = false }: TimelineStepProps) {
  return (
    <HStack gap={12}>
      {/* 점을 이은 선이 다음 단계까지 이어져 순서가 한눈에 보인다 */}
      <VStack className="w-2.5 items-center pt-1.5">
        <Box className="size-2.5 rounded-full bg-main" />
        {!isLast && <Box className="mt-1 w-px flex-1 bg-main/30" />}
      </VStack>

      <VStack gap={2} className={cn('flex-1', !isLast && 'pb-3')}>
        <Text size="e1" weight="semibold" tone="brand" className="tabular-nums">
          {date}
        </Text>
        <Text size="b4" shade={8} lineBreakStrategyIOS="hangul-word">
          {title}
        </Text>
        {hint != null && (
          <Text size="e1" shade={6} lineBreakStrategyIOS="hangul-word">
            {hint}
          </Text>
        )}
      </VStack>
    </HStack>
  );
}

import { PREMIUM_TRIAL_ENDING_NOTICE_DAYS } from '@aido/api/vocabulary';
import { useTrack } from '@src/shared/analytics';
import { formatDateKeyLabel } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import { Box, HStack, IconCircle, PawIcon, Text, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Separator } from 'heroui-native';
import { type ComponentProps, type ComponentType, useEffect, useRef } from 'react';
import { match } from 'ts-pattern';

import { PLAN_PRICE_LABEL_KEYS } from '../constants/subscription-labels';
import { SubscriptionPolicy } from '../domains/subscription.model';
import { useSelectedPlanId } from '../hooks/use-subscription-params';
import { useGetOfferingsQueryOptions } from '../queries/subscription.queries';
import { toTrialScheduleSteps, type TrialStampState } from '../utils/trial-schedule.view-model';

interface TrialTimelineProps extends Omit<ComponentProps<typeof VStack>, 'children'> {
  /** 알림 도장이 있을 때 일정 아래에 둘 알림 켜기. 알림일은 일정이 정하므로 받아서 그린다 */
  reminder?: ComponentType<{ reminderDateKey: string }>;
}

/**
 * 체험을 줄 수 있는 요금제를 골랐을 때 결제까지의 날짜를 도장으로 보여 준다(App Store 3.1.2: 체험 기간·뒤 금액·해지).
 * 날짜는 결제 전 예상이고, 결제 뒤 실제 날짜는 서버가 준 영수증이 보여 준다
 */
export function TrialTimeline({ reminder: Reminder, className, ...props }: TrialTimelineProps) {
  const { t } = useTranslation('subscription');
  const [planId] = useSelectedPlanId();
  const { data: availability } = useSuspenseQuery(useGetOfferingsQueryOptions());
  const { currentLocalDateKey } = useLocalDate();
  const dateFormatContext = useDateFormatContext();
  const { trackEvent } = useTrack();
  const hasTrackedRef = useRef(false);
  const plan =
    availability.status === 'available'
      ? SubscriptionPolicy.findSelectedPlan(availability.offering, planId)
      : null;
  const steps = plan == null ? null : toTrialScheduleSteps(plan, currentLocalDateKey);
  const visiblePlanType = steps == null ? null : (plan?.planType ?? null);

  // 요금제를 오가며 다시 보여도 페이월을 본 한 번만 센다
  useEffect(() => {
    if (visiblePlanType == null || hasTrackedRef.current) {
      return;
    }
    hasTrackedRef.current = true;
    trackEvent('trial_timeline_viewed', { plan_type: visiblePlanType });
  }, [trackEvent, visiblePlanType]);

  if (plan == null || steps == null) {
    return null;
  }
  const formatDate = (dateKey: string) =>
    formatDateKeyLabel(dateKey, 'monthDay', dateFormatContext);
  const price = t(PLAN_PRICE_LABEL_KEYS[plan.planType], { price: plan.priceString });
  const reminderStep = steps.find((step) => step.kind === 'reminder');
  const chargeStep = steps.find((step) => step.kind === 'charge');

  return (
    <VStack
      gap={14}
      className={cn('rounded-2xl bg-white px-3 py-4 dark:bg-gray-2', className)}
      testID="subscription-trial-timeline"
      {...props}
    >
      <Text size="b4" weight="semibold" tone="brand" className="px-1">
        {t('trialTimeline.title')}
      </Text>

      <HStack align="start">
        {steps.map((step, index) => (
          <Stamp
            key={step.kind}
            state={step.stamp}
            hasLineBefore={index > 0}
            hasLineAfter={index < steps.length - 1}
            label={match(step)
              .with({ kind: 'start' }, () => t('trialTimeline.today'))
              .with({ kind: 'reminder' }, { kind: 'charge' }, ({ dateKey }) => formatDate(dateKey))
              .exhaustive()}
            description={match(step)
              .with({ kind: 'start' }, () => t('trialTimeline.start'))
              .with({ kind: 'reminder' }, () =>
                t('trialTimeline.reminder', { days: PREMIUM_TRIAL_ENDING_NOTICE_DAYS }),
              )
              .with({ kind: 'charge' }, () => t('trialTimeline.charge', { price }))
              .exhaustive()}
          />
        ))}
      </HStack>

      {chargeStep != null && (
        <Text size="e1" shade={6} align="center" lineBreakStrategyIOS="hangul-word">
          {t('trialTimeline.cancelHint', { date: formatDate(chargeStep.dateKey) })}
        </Text>
      )}

      {Reminder != null && reminderStep != null && (
        <>
          <Separator className="bg-gray-3" />
          <Reminder reminderDateKey={reminderStep.dateKey} />
        </>
      )}
    </VStack>
  );
}

const STAMP_SIZE = 44;
const PAW_ICON_SIZE = 20;

/** 초대 발자국 판과 같은 도장 모양. 찍힘은 시작한 체험, 기다림은 알림, 빈 칸은 첫 결제다 */
const STAMP_STYLES = {
  stamped: { tone: 'brand', className: '-rotate-6', iconClassName: 'text-white dark:text-gray-1' },
  waiting: { tone: 'outline', className: undefined, iconClassName: 'text-main opacity-40' },
  empty: { tone: 'neutral', className: undefined, iconClassName: 'text-gray-4 dark:text-gray-3' },
} as const satisfies Record<
  TrialStampState,
  {
    tone: ComponentProps<typeof IconCircle>['tone'];
    className: string | undefined;
    iconClassName: string;
  }
>;

interface StampProps {
  state: TrialStampState;
  label: string;
  description: string;
  hasLineBefore: boolean;
  hasLineAfter: boolean;
}

function Stamp({ state, label, description, hasLineBefore, hasLineAfter }: StampProps) {
  const fontScaledSize = useFontScaledSize();
  const stampSize = fontScaledSize(STAMP_SIZE);
  const iconSize = fontScaledSize(PAW_ICON_SIZE);
  const { tone, className, iconClassName } = STAMP_STYLES[state];

  return (
    <VStack flex={1} gap={4} align="center">
      <HStack align="center" className="mb-1 self-stretch">
        <StampLine isVisible={hasLineBefore} />
        <IconCircle
          tone={tone}
          className={className}
          style={{ width: stampSize, height: stampSize }}
          icon={
            <>
              {state === 'stamped' && (
                <Box className="absolute inset-1 rounded-full border border-dashed border-white/90 dark:border-gray-1/90" />
              )}
              <PawIcon width={iconSize} height={iconSize} colorClassName={iconClassName} />
            </>
          }
        />
        <StampLine isVisible={hasLineAfter} />
      </HStack>

      <Text
        size="e1"
        weight="semibold"
        tone={state === 'stamped' ? 'brand' : 'neutral'}
        shade={8}
        align="center"
        className="tabular-nums"
      >
        {label}
      </Text>
      <Text size="e1" shade={6} align="center" lineBreakStrategyIOS="hangul-word">
        {description}
      </Text>
    </VStack>
  );
}

/** 도장 사이를 잇는 선. 양 끝 도장 바깥쪽은 자리만 잡아 도장이 칸 가운데에 온다 */
function StampLine({ isVisible }: { isVisible: boolean }) {
  return <Box className={cn('h-0.5 flex-1 rounded-full', isVisible && 'bg-gray-3')} />;
}

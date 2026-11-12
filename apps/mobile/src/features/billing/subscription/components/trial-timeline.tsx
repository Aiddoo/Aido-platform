import { PREMIUM_TRIAL_ENDING_NOTICE_DAYS } from '@aido/api/vocabulary';
import { useHaptics } from '@src/bootstrap/providers/di-context';
import { useTrack } from '@src/shared/analytics';
import { ANIMATION } from '@src/shared/constants/animation';
import type { DateKey } from '@src/shared/date/date-key';
import { formatYearAwareDateKeyLabel } from '@src/shared/date/format/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { useLocalDate } from '@src/shared/providers/local-date-provider';
import {
  Box,
  HStack,
  IconCircle,
  PawIcon,
  SettingsListGroup,
  StampPress,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Separator, Skeleton } from 'heroui-native';
import { type ComponentProps, type ComponentType, useEffect, useRef } from 'react';
import Animated, { FadeIn, FadeOut, ReduceMotion } from 'react-native-reanimated';
import { match } from 'ts-pattern';

import { SubscriptionPolicy } from '../domains/subscription.model';
import { useSelectedPlanId } from '../hooks/use-subscription-params';
import { useGetOfferingsQueryOptions } from '../queries/subscription.queries';
import { getPlanPriceLabelKey } from '../utils/subscription-label.view-model';
import {
  shouldBuzzOnTrialStamp,
  toTrialScheduleSteps,
  type TrialStampState,
} from '../utils/trial-schedule.view-model';

/** 요금제를 바꿔 일정이 나타나고 사라질 때 아래 내용이 툭 밀리지 않게 짧게 비친다 */
const TIMELINE_ENTERING = FadeIn.duration(ANIMATION.durationMs.fast).reduceMotion(
  ReduceMotion.System,
);
const TIMELINE_EXITING = FadeOut.duration(ANIMATION.durationMs.fast).reduceMotion(
  ReduceMotion.System,
);

type TrialTimelineLoadingProps = Omit<ComponentProps<typeof VStack>, 'children'>;

interface TrialTimelineProps extends Omit<ComponentProps<typeof VStack>, 'children'> {
  /** 알림 도장이 있을 때 일정 아래에 둘 알림 켜기. 알림일은 일정이 정하므로 받아서 그린다 */
  reminder?: ComponentType<{ reminderDateKey: DateKey }>;
}

/** 체험 요금제를 골랐을 때 결제까지의 예상 날짜를 도장으로 보여 준다(App Store 3.1.2: 체험 기간·뒤 금액·해지). 실제 날짜는 결제 뒤 서버 영수증이 보여 준다 */
export function TrialTimeline({ reminder: Reminder, className, ...props }: TrialTimelineProps) {
  const { t } = useTranslation(['subscription', 'common']);
  const [planId] = useSelectedPlanId();
  const { data: availability } = useSuspenseQuery(useGetOfferingsQueryOptions());
  const { currentLocalDateKey } = useLocalDate();
  const dateFormatContext = useDateFormatContext();
  const { trackEvent } = useTrack();
  const haptics = useHaptics();
  const hasTrackedRef = useRef(false);
  const wasVisibleRef = useRef<boolean | null>(null);
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

  useEffect(() => {
    const isVisible = visiblePlanType != null;
    if (shouldBuzzOnTrialStamp(wasVisibleRef.current, isVisible)) {
      haptics.impact('light');
    }
    wasVisibleRef.current = isVisible;
  }, [haptics, visiblePlanType]);

  if (plan == null || steps == null) {
    return null;
  }
  const formatDate = (dateKey: DateKey) =>
    formatYearAwareDateKeyLabel(dateKey, currentLocalDateKey, dateFormatContext);
  const price = t(getPlanPriceLabelKey(plan.planType), { price: plan.priceString });
  const reminderStep = steps.find((step) => step.kind === 'reminder');
  const chargeStep = steps.find((step) => step.kind === 'charge');

  return (
    <Animated.View entering={TIMELINE_ENTERING} exiting={TIMELINE_EXITING}>
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
                .with({ kind: 'start' }, () => t('common:relativeDay.today'))
                .with({ kind: 'reminder' }, { kind: 'charge' }, ({ dateKey }) =>
                  formatDate(dateKey),
                )
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
    </Animated.View>
  );
}

/** 체험이 가능한 첫 방문자에게 일정이 늦게 끼어들어 아래가 밀리지 않게 같은 자리를 잡는다 */
TrialTimeline.Loading = function Loading({ className, ...props }: TrialTimelineLoadingProps) {
  const fontScaledSize = useFontScaledSize();
  const stampSize = fontScaledSize(STAMP_SIZE);

  return (
    <VStack
      gap={14}
      accessibilityState={{ busy: true }}
      className={cn('rounded-2xl bg-white px-3 py-4 dark:bg-gray-2', className)}
      {...props}
    >
      <TextSkeleton size="b4" className="mx-1 w-32" />

      <HStack align="start">
        {range(TIMELINE_STEP_COUNT).map((index) => (
          <VStack key={index} flex={1} gap={4} align="center">
            <Skeleton
              className="mb-1 rounded-full"
              style={{ width: stampSize, height: stampSize }}
            />
            <TextSkeleton size="e1" className="w-14" />
            <TextSkeleton size="e1" className="w-16" />
          </VStack>
        ))}
      </HStack>

      <TextSkeleton size="e1" className="w-full" />

      <Separator className="bg-gray-3" />
      <SettingsListGroup.Toggle.Loading hasDescription />
    </VStack>
  );
};

const STAMP_SIZE = 44;
const TIMELINE_STEP_COUNT = 3;
const PAW_ICON_SIZE = 20;

const STAMP_STYLES = {
  stamped: { tone: 'brand', iconClassName: 'text-white dark:text-gray-1' },
  waiting: { tone: 'outline', iconClassName: 'text-main opacity-40' },
  empty: { tone: 'neutral', iconClassName: 'text-gray-4 dark:text-gray-3' },
} as const satisfies Record<
  TrialStampState,
  {
    tone: ComponentProps<typeof IconCircle>['tone'];
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
  const { tone, iconClassName } = STAMP_STYLES[state];
  const circle = (
    <IconCircle
      tone={tone}
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
  );

  return (
    <VStack flex={1} gap={4} align="center">
      <HStack align="center" className="mb-1 self-stretch">
        <StampLine isVisible={hasLineBefore} />
        {state === 'stamped' ? (
          // 일정이 나타날 때(페이월 처음·체험 요금제로 바꿀 때) 한 번 쿵 찍힌다
          <StampPress>{circle}</StampPress>
        ) : (
          circle
        )}
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

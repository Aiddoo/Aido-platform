import { useTrack } from '@src/shared/analytics';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  CheckIcon,
  HintPopoverContent,
  HStack,
  type QueryErrorFallbackProps,
  QueryErrorFallback,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Popover, PressableFeedback } from 'heroui-native';
import { Fragment, useState } from 'react';
import { match } from 'ts-pattern';

import {
  PLAN_COMPARISON_GROUPS,
  type PlanComparisonGroup,
} from '../constants/subscription.constants';
import { useFormatPlanValue } from '../hooks/use-format-plan-value';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';
import { type PlanValue, toPlanFeatureComparison } from '../utils/plan-benefit.view-model';
import { getPremiumGateAnalyticsFeature } from '../utils/subscription-analytics';

type ComparisonFeature = (typeof PLAN_COMPARISON_GROUPS)[number]['features'][number];

const GROUP_LABEL_KEYS = {
  ai: 'planComparison.groups.ai',
  limits: 'planComparison.groups.limits',
  reminderAndLooks: 'planComparison.groups.reminderAndLooks',
} as const satisfies Record<PlanComparisonGroup, string>;

const ROW_TEXT_KEYS = {
  AI_PARSE: {
    label: 'planComparison.rows.aiParse.label',
    term: 'planComparison.rows.aiParse.term',
  },
  AI_REPORT: {
    label: 'planComparison.rows.aiReport.label',
    term: 'planComparison.rows.aiReport.term',
  },
  AI_SUGGESTION: {
    label: 'planComparison.rows.aiSuggestion.label',
    term: 'planComparison.rows.aiSuggestion.term',
  },
  VOICE_NOTE: {
    label: 'planComparison.rows.voiceNote.label',
    term: 'planComparison.rows.voiceNote.term',
  },
  FRIEND: { label: 'planComparison.rows.friend.label', term: 'planComparison.rows.friend.term' },
  NUDGE: { label: 'planComparison.rows.nudge.label', term: 'planComparison.rows.nudge.term' },
  TODO_CATEGORY: {
    label: 'planComparison.rows.category.label',
    term: 'planComparison.rows.category.term',
  },
  CUSTOM_REMINDER_TIME: {
    label: 'planComparison.rows.reminderTime.label',
    term: 'planComparison.rows.reminderTime.term',
  },
  APP_ICON: {
    label: 'planComparison.rows.appIcon.label',
    term: 'planComparison.rows.appIcon.term',
  },
} as const satisfies Record<ComparisonFeature, { label: string; term: string }>;

/** 무료와 프리미엄 비교표. 숫자는 서버 스냅샷(무료)과 카탈로그(프리미엄)에서 오고, 이름을 누르면 설명이 떠서 줄이 밀리지 않는다 */
export function PlanComparisonTable() {
  const { t } = useTranslation('subscription');
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());

  return (
    <VStack className="overflow-hidden rounded-2xl border border-gray-3 bg-white dark:bg-gray-2">
      <HStack align="center" className="min-h-11 bg-gray-1 px-3">
        <Text size="e1" weight="semibold" shade={7} className="flex-[1.4]">
          {t('planComparison.benefit')}
        </Text>
        <Text size="e1" weight="semibold" shade={7} align="center" className="flex-[0.8]">
          {t('upsell.free')}
        </Text>
        <Text size="e1" weight="semibold" tone="brand" align="center" className="flex-[0.9]">
          {t('upsell.premium')}
        </Text>
      </HStack>

      {PLAN_COMPARISON_GROUPS.map(({ group, features }) => (
        <Fragment key={group}>
          <Box className="min-h-9 justify-center border-t border-gray-3 px-3">
            <Text size="e1" weight="semibold" shade={7}>
              {t(GROUP_LABEL_KEYS[group])}
            </Text>
          </Box>
          {features.map((feature) => (
            <Row
              key={feature}
              feature={feature}
              {...toPlanFeatureComparison(entitlements, feature)}
            />
          ))}
        </Fragment>
      ))}
    </VStack>
  );
}

interface RowProps {
  feature: ComparisonFeature;
  free: PlanValue;
  premium: PlanValue;
}

function Row({ feature, free, premium }: RowProps) {
  const { t } = useTranslation('subscription');

  return (
    <HStack align="center" className="min-h-11 border-t border-gray-3 px-3 py-2">
      <Box className="flex-[1.4] items-start">
        <Term feature={feature} label={t(ROW_TEXT_KEYS[feature].label)} />
      </Box>
      <Box className="flex-[0.8] items-center">
        <Cell value={free} />
      </Box>
      <Box className="flex-[0.9] items-center">
        <Cell value={premium} isPremium />
      </Box>
    </HStack>
  );
}

function Term({ feature, label }: { feature: ComparisonFeature; label: string }) {
  const { t } = useTranslation('subscription');
  const { trackEvent } = useTrack();
  const [isOpen, setIsOpen] = useState(false);

  const handleOpenChange = (nextIsOpen: boolean) => {
    setIsOpen(nextIsOpen);
    if (nextIsOpen) {
      trackEvent('plan_comparison_term_opened', {
        feature: getPremiumGateAnalyticsFeature(feature),
      });
    }
  };

  return (
    <Popover isOpen={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger asChild>
        <PressableFeedback
          accessibilityRole="button"
          accessibilityLabel={label}
          accessibilityHint={t('planComparison.hint')}
          hitSlop={8}
          testID={`plan-comparison-term-${feature}`}
        >
          <Text size="b4" shade={8} underline lineBreakStrategyIOS="hangul-word">
            {label}
          </Text>
        </PressableFeedback>
      </Popover.Trigger>
      <HintPopoverContent
        placement="bottom"
        align="start"
        title={label}
        description={t(ROW_TEXT_KEYS[feature].term)}
      />
    </Popover>
  );
}

function Cell({ value, isPremium = false }: { value: PlanValue; isPremium?: boolean }) {
  const formatPlanValue = useFormatPlanValue();
  const fontScaledSize = useFontScaledSize();
  const label = formatPlanValue(value);

  return match(value)
    .with({ type: 'included' }, () => (
      <Box accessible accessibilityRole="text" accessibilityLabel={label}>
        <CheckIcon
          width={fontScaledSize(18)}
          height={fontScaledSize(18)}
          colorClassName="text-main"
        />
      </Box>
    ))
    .with({ type: 'excluded' }, () => (
      <Text size="b4" shade={5} align="center" accessibilityLabel={label}>
        –
      </Text>
    ))
    .with({ type: 'amount' }, { type: 'unlimited' }, () => (
      <Text
        size="b4"
        weight={isPremium ? 'bold' : 'normal'}
        tone={isPremium ? 'brand' : 'neutral'}
        shade={7}
        align="center"
        className="tabular-nums"
      >
        {label}
      </Text>
    ))
    .exhaustive();
}

const LOADING_ROW_COUNT = 9;

PlanComparisonTable.Loading = function Loading() {
  return (
    <VStack
      accessibilityState={{ busy: true }}
      className="overflow-hidden rounded-2xl border border-gray-3 bg-white dark:bg-gray-2"
    >
      {range(LOADING_ROW_COUNT).map((row) => (
        <HStack key={row} align="center" gap={12} className="min-h-11 border-t border-gray-3 px-3">
          <TextSkeleton size="b4" className="flex-[1.4]" />
          <TextSkeleton size="b4" className="flex-[0.8]" />
          <TextSkeleton size="b4" className="flex-[0.9]" />
        </HStack>
      ))}
    </VStack>
  );
};

PlanComparisonTable.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return <QueryErrorFallback className="py-4" illustrationSize="block" reset={reset} />;
};

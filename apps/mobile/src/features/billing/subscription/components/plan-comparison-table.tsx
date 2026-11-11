import { useTrack } from '@src/shared/analytics';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  CheckmarkIcon,
  FriendsDuoIcon,
  HintPopoverContent,
  HStack,
  InfoIcon,
  type QueryErrorFallbackProps,
  QueryErrorFallback,
  ReminderDuoIcon,
  ReportDuoIcon,
  type StyledIcon,
  Text,
  TextSkeleton,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { Popover, PressableFeedback, Separator } from 'heroui-native';
import { type ReactNode, useState } from 'react';
import { match } from 'ts-pattern';
import { useResolveClassNames } from 'uniwind';

import type { EntitlementFeature } from '../domains/entitlement.model';
import { useFormatPlanValue } from '../hooks/use-format-plan-value';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';
import { type PlanValue, toPlanFeatureComparison } from '../utils/plan-benefit.view-model';
import { getPremiumGateAnalyticsFeature } from '../utils/subscription-analytics';

/** 응원(CHEER)은 같은 한도인 콕 찌르기 줄이 함께 보여 준다 */
type ComparisonFeature = Exclude<EntitlementFeature, 'CHEER'>;

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

/** 두 값 칸은 글꼴 배율을 따라 같은 폭으로 넓어져 모든 줄의 숫자가 같은 세로선에 선다 */
const VALUE_COLUMN_WIDTH = 80;
const PREMIUM_BAND_INSET = 6;
/** 정보 아이콘이 마지막 낱말과 떨어져 혼자 다음 줄로 내려가지 않게 붙인다 */
const NBSP = '\u00A0';

function useValueColumnWidth() {
  const fontScaledSize = useFontScaledSize();
  return fontScaledSize(VALUE_COLUMN_WIDTH);
}

/** 무료와 프리미엄 비교표. 숫자는 서버 스냅샷(무료)과 카탈로그(프리미엄)에서 오고, 이름을 누르면 설명이 떠서 줄이 밀리지 않는다 */
export function PlanComparisonTable() {
  const { t } = useTranslation('subscription');

  return (
    <ComparisonCard>
      <Header />

      <Group Icon={ReportDuoIcon} label={t('planComparison.groups.ai')}>
        <Row feature="AI_PARSE" />
        <Divider />
        <Row feature="AI_REPORT" />
        <Divider />
        <Row feature="AI_SUGGESTION" />
        <Divider />
        <Row feature="VOICE_NOTE" />
      </Group>

      <Group Icon={FriendsDuoIcon} label={t('planComparison.groups.limits')}>
        <Row feature="FRIEND" />
        <Divider />
        <Row feature="NUDGE" />
        <Divider />
        <Row feature="TODO_CATEGORY" />
      </Group>

      <Group Icon={ReminderDuoIcon} label={t('planComparison.groups.reminderAndLooks')}>
        <Row feature="CUSTOM_REMINDER_TIME" />
        <Divider />
        <Row feature="APP_ICON" />
      </Group>
    </ComparisonCard>
  );
}

/** 프리미엄 칸 뒤에 옅은 띠를 깔아 위아래로 훑어 읽게 한다 */
function ComparisonCard({ children, busy = false }: { children: ReactNode; busy?: boolean }) {
  const valueColumnWidth = useValueColumnWidth();

  return (
    <VStack
      accessibilityState={{ busy }}
      className="overflow-hidden rounded-2xl border border-gray-3 bg-white pb-2 dark:bg-gray-2"
    >
      <Box
        className="absolute rounded-xl bg-main/5 dark:bg-main/8"
        style={{
          top: PREMIUM_BAND_INSET,
          right: PREMIUM_BAND_INSET,
          bottom: PREMIUM_BAND_INSET,
          width: valueColumnWidth,
        }}
      />
      {children}
    </VStack>
  );
}

// oxlint-disable-next-line aido/component-name -- 1.15.2 전환 #1400
function Header() {
  const { t } = useTranslation('subscription');
  const valueColumnWidth = useValueColumnWidth();

  return (
    <>
      <HStack align="center" className="min-h-14 pl-4" style={{ paddingRight: PREMIUM_BAND_INSET }}>
        <Text size="e1" weight="medium" shade={6} className="flex-1 pr-3">
          {t('planComparison.benefit')}
        </Text>
        <Text
          size="b4"
          weight="semibold"
          shade={6}
          align="center"
          style={{ width: valueColumnWidth }}
        >
          {t('upsell.free')}
        </Text>
        <Text
          size="b4"
          weight="bold"
          tone="brand"
          align="center"
          style={{ width: valueColumnWidth }}
        >
          {t('upsell.premium')}
        </Text>
      </HStack>
      <Divider />
    </>
  );
}

function Group({
  Icon,
  label,
  children,
}: {
  Icon: StyledIcon;
  label: string;
  children: ReactNode;
}) {
  const fontScaledSize = useFontScaledSize();

  return (
    <>
      <HStack align="center" gap={6} className="px-4 pb-1 pt-4">
        <Icon width={fontScaledSize(16)} height={fontScaledSize(16)} colorClassName="text-gray-6" />
        <Text size="e1" weight="semibold" shade={7} accessibilityRole="header">
          {label}
        </Text>
      </HStack>
      {children}
    </>
  );
}

function Divider() {
  const valueColumnWidth = useValueColumnWidth();

  return (
    <Separator
      className="ml-4 bg-gray-2 dark:bg-gray-3"
      style={{ marginRight: valueColumnWidth + PREMIUM_BAND_INSET }}
    />
  );
}

function Row({ feature }: { feature: ComparisonFeature }) {
  const { t } = useTranslation('subscription');
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const { free, premium } = toPlanFeatureComparison(entitlements, feature);
  const valueColumnWidth = useValueColumnWidth();

  return (
    <HStack align="center" className="min-h-12 pl-4" style={{ paddingRight: PREMIUM_BAND_INSET }}>
      <Box className="flex-1 items-start py-3 pr-3">
        <Term feature={feature} label={t(ROW_TEXT_KEYS[feature].label)} />
      </Box>
      <Box className="items-center px-1 py-3" style={{ width: valueColumnWidth }}>
        <Cell value={free} />
      </Box>
      <Box className="items-center px-1 py-3" style={{ width: valueColumnWidth }}>
        <Cell value={premium} isPremium />
      </Box>
    </HStack>
  );
}

function Term({ feature, label }: { feature: ComparisonFeature; label: string }) {
  const { t } = useTranslation('subscription');
  const { trackEvent } = useTrack();
  const fontScaledSize = useFontScaledSize();
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
          <Text size="b4" shade={8} lineBreakStrategyIOS="hangul-word">
            {label}
            {NBSP}
            <InfoIcon
              width={fontScaledSize(14)}
              height={fontScaledSize(14)}
              colorClassName="text-gray-4"
            />
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
  const markSize = fontScaledSize(20);

  return match(value)
    .with({ type: 'included' }, () => (
      <Box
        accessible
        accessibilityRole="text"
        accessibilityLabel={label}
        className="items-center justify-center rounded-full bg-main"
        style={{ width: markSize, height: markSize }}
      >
        <CheckmarkIcon
          width={fontScaledSize(12)}
          height={fontScaledSize(12)}
          colorClassName="text-white dark:text-gray-9"
        />
      </Box>
    ))
    .with({ type: 'excluded' }, () => (
      <Box
        accessible
        accessibilityRole="text"
        accessibilityLabel={label}
        className="items-center justify-center"
        style={{ width: markSize, height: markSize }}
      >
        <Box className="h-0.5 w-2.5 rounded-full bg-gray-4" />
      </Box>
    ))
    .with({ type: 'amount' }, { type: 'unlimited' }, () => (
      <Text
        size="b4"
        weight={isPremium ? 'bold' : 'normal'}
        tone={isPremium ? 'brand' : 'neutral'}
        shade={6}
        align="center"
        className="tabular-nums"
      >
        {label}
      </Text>
    ))
    .exhaustive();
}

const LOADING_ROW_COUNT = 4;

PlanComparisonTable.Loading = function Loading() {
  // 다크에서 카드 바탕(gray-2)과 기본 글 스켈레톤 색이 같아 한 단계 밝은 색으로 그린다
  const { backgroundColor: skeletonColor } = useResolveClassNames('bg-gray-3');
  const color = typeof skeletonColor === 'string' ? skeletonColor : undefined;
  const valueColumnWidth = useValueColumnWidth();

  return (
    <ComparisonCard busy>
      <Header />
      {range(LOADING_ROW_COUNT).map((row) => (
        <HStack
          key={row}
          align="center"
          className="min-h-12 pl-4"
          style={{ paddingRight: PREMIUM_BAND_INSET }}
        >
          <Box className="flex-1 pr-3">
            <TextSkeleton size="b4" color={color} />
          </Box>
          <Box className="px-3" style={{ width: valueColumnWidth }}>
            <TextSkeleton size="b4" color={color} />
          </Box>
          <Box className="px-3" style={{ width: valueColumnWidth }}>
            <TextSkeleton size="b4" color={color} />
          </Box>
        </HStack>
      ))}
    </ComparisonCard>
  );
};

PlanComparisonTable.Error = function ErrorFallback({ reset }: QueryErrorFallbackProps) {
  return <QueryErrorFallback className="py-4" illustrationSize="block" reset={reset} />;
};

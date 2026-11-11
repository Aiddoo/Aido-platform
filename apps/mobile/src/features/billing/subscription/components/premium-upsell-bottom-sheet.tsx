import type { PlanLimitFeatureKey } from '@aido/api/vocabulary';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  Button,
  H4,
  HStack,
  Meter,
  ModalBottomSheet,
  QueryErrorBoundary,
  Text,
  TextButton,
  VStack,
  SurfaceCard,
} from '@src/shared/ui';
import { formatCount } from '@src/shared/utils/number-format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Skeleton } from 'heroui-native';
import { type ComponentProps, Suspense } from 'react';
import { match } from 'ts-pattern';

import { type EntitlementFeature } from '../domains/entitlement.model';
import { EntitlementPolicy } from '../domains/entitlement.model';
import { useFormatRefillSentence } from '../hooks/use-format-refill-sentence';
import { useQuotaStatus } from '../hooks/use-quota-status';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';
import { getPlanComparison } from '../utils/plan-benefit.view-model';
import { PremiumFeatureIcon } from './premium-feature-icon';

interface PremiumUpsellAlternativeAction {
  label: string;
  onPress: () => void;
}

type PremiumUpsellBottomSheetProps = Omit<
  ComponentProps<typeof ModalBottomSheet>,
  'children' | 'footer'
> & {
  feature: EntitlementFeature;
  title: string;
  /** 부른 쪽이 상황을 직접 설명하면 사용량·숫자 대신 이 글을 보여 준다 */
  description?: string;
  /** 무료로 할 수 있는 다른 길. 있으면 주 버튼이 되고 프리미엄 보기는 글자 버튼으로 내려간다 */
  alternativeAction?: PremiumUpsellAlternativeAction;
  onSubscribe: () => void;
};

/** 열 때 값이 굳는 overlay라 사용량은 시트가 직접 읽는다 */
export function PremiumUpsellBottomSheet({
  feature,
  title,
  description,
  alternativeAction,
  onSubscribe,
  onOpenChange,
  ...sheetProps
}: PremiumUpsellBottomSheetProps) {
  const { t } = useTranslation('subscription');

  return (
    <ModalBottomSheet
      {...sheetProps}
      onOpenChange={onOpenChange}
      footer={
        alternativeAction == null ? (
          <VStack gap={12}>
            <Button size="large" display="full" onPress={onSubscribe} testID="premium-upsell-cta">
              {t('upsell.viewPremium')}
            </Button>
            <TextButton size="medium" onPress={() => onOpenChange(false)}>
              {t('upsell.later')}
            </TextButton>
          </VStack>
        ) : (
          <VStack gap={12}>
            <Button size="large" display="full" onPress={alternativeAction.onPress}>
              {alternativeAction.label}
            </Button>
            <TextButton size="medium" onPress={onSubscribe} testID="premium-upsell-cta">
              {t('upsell.viewPremium')}
            </TextButton>
          </VStack>
        )
      }
    >
      <VStack gap={20} testID="premium-upsell-sheet">
        <VStack gap={12} align="center">
          <PremiumFeatureIcon feature={feature} size="large" />
          <H4 align="center" lineBreakStrategyIOS="hangul-word" textBreakStrategy="highQuality">
            {title}
          </H4>
          {description != null && (
            <Text size="b3" shade={7} align="center" lineBreakStrategyIOS="hangul-word">
              {description}
            </Text>
          )}
        </VStack>

        {description == null && (
          <QueryErrorBoundary fallback={PremiumUpsellBottomSheet.Error}>
            <Suspense fallback={<PremiumUpsellBottomSheet.Loading />}>
              <PremiumUpsellBottomSheet.FeatureDetail feature={feature} />
            </Suspense>
          </QueryErrorBoundary>
        )}
      </VStack>
    </ModalBottomSheet>
  );
}

const LOCKED_DESCRIPTION_KEYS = {
  AI_REPORT: 'gate.aiReportDescription',
  AI_SUGGESTION: 'gate.aiSuggestionDescription',
  CUSTOM_REMINDER_TIME: 'gate.reminderTimeDescription',
  APP_ICON: 'gate.appIconDescription',
} as const satisfies Record<Exclude<EntitlementFeature, PlanLimitFeatureKey>, string>;

/** 잠긴 기능은 무엇을 여는지, 한도 기능은 사용량과 "무료 → 프리미엄" 숫자를 보여 준다 */
PremiumUpsellBottomSheet.FeatureDetail = function FeatureDetail({
  feature,
}: {
  feature: EntitlementFeature;
}) {
  const { t } = useTranslation('subscription');

  return match(feature)
    .with('AI_REPORT', 'AI_SUGGESTION', 'CUSTOM_REMINDER_TIME', 'APP_ICON', (lockedFeature) => (
      <Text size="b3" shade={7} align="center" lineBreakStrategyIOS="hangul-word">
        {t(LOCKED_DESCRIPTION_KEYS[lockedFeature])}
      </Text>
    ))
    .with('AI_PARSE', 'VOICE_NOTE', 'CHEER', 'NUDGE', 'FRIEND', 'TODO_CATEGORY', (limitFeature) => (
      <VStack gap={16}>
        <Usage feature={limitFeature} />
        <Comparison feature={limitFeature} />
      </VStack>
    ))
    .exhaustive();
};

PremiumUpsellBottomSheet.Loading = function Loading() {
  return (
    <VStack gap={16} accessibilityState={{ busy: true }}>
      <Skeleton className="h-2 rounded-full" />
      <Skeleton className="h-16 rounded-2xl" />
    </VStack>
  );
};

/** 숫자를 못 읽어도 제목과 버튼만으로 안내는 끝나 자리를 비운다 */
PremiumUpsellBottomSheet.Error = function ErrorFallback() {
  return null;
};

/** 기간마다 다시 생기는 한도를 다 썼을 때만 막대와 다시 생기는 날을 보여 준다 */
function Usage({ feature }: { feature: PlanLimitFeatureKey }) {
  const { t } = useTranslation('subscription');
  const { locale } = useDateFormatContext();
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const { type } = useQuotaStatus(feature);
  const formatRefillSentence = useFormatRefillSentence();
  const used = EntitlementPolicy.getUsedCount(entitlements, feature);
  const limit = EntitlementPolicy.getLimit(entitlements, feature);

  if (type !== 'used-up' || used == null || limit == null) {
    return null;
  }

  const refill = formatRefillSentence(entitlements, feature);

  return (
    <VStack gap={8}>
      <Meter
        value={used}
        max={limit}
        size="medium"
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      <HStack gap={8} justify="between" align="center">
        <Text size="e1" shade={6} className="tabular-nums">
          {t('upsell.usage', {
            used: formatCount(used, locale),
            limit: formatCount(limit, locale),
          })}
        </Text>
        {refill != null && (
          <Text size="e1" weight="semibold" shade={7} align="right" className="flex-1">
            {refill}
          </Text>
        )}
      </HStack>
    </VStack>
  );
}

function Comparison({ feature }: { feature: PlanLimitFeatureKey }) {
  const { t } = useTranslation('subscription');
  const { locale } = useDateFormatContext();
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const { unit, free, premium } = getPlanComparison(entitlements, feature);

  const formatAmount = (amount: number | null) => {
    if (amount == null) {
      return t('upsell.unlimited');
    }
    const value = formatCount(amount, locale);
    return match(unit)
      .with('perMonth', () => t('upsell.amount.perMonth', { amount: value }))
      .with('perDay', () => t('upsell.amount.perDay', { amount: value }))
      .with('people', () => t('upsell.amount.people', { amount: value }))
      .with('items', () => t('upsell.amount.items', { amount: value }))
      .exhaustive();
  };

  return (
    <SurfaceCard className="flex-row items-center gap-3">
      <VStack flex={1} gap={2} align="center">
        <Text size="e1" shade={6}>
          {t('upsell.free')}
        </Text>
        <Text size="b3" weight="bold" shade={8}>
          {formatAmount(free)}
        </Text>
      </VStack>
      <ArrowRightIcon width={16} height={16} colorClassName="text-gray-5" />
      <VStack flex={1} gap={2} align="center">
        <Text size="e1" shade={6}>
          {t('upsell.premium')}
        </Text>
        <Text size="b3" weight="bold" tone="brand">
          {formatAmount(premium)}
        </Text>
      </VStack>
    </SurfaceCard>
  );
}

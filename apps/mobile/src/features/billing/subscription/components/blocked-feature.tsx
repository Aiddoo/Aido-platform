import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { HStack, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { formatCount } from '@src/shared/utils/number-format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Chip, Skeleton } from 'heroui-native';
import type { ComponentProps } from 'react';
import { match } from 'ts-pattern';

import { BENEFIT_SLIDES } from '../constants/subscription.constants';
import { type EntitlementFeature } from '../domains/entitlement.model';
import { useSubscriptionParams } from '../hooks/use-subscription-params';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';
import { hasBenefitSlide } from '../utils/benefit-slides.view-model';
import { getPlanBenefitAmounts } from '../utils/plan-benefit.view-model';
import { PremiumFeatureIcon } from './premium-feature-icon';

type BlockedFeatureProps = Pick<ComponentProps<typeof VStack>, 'className'>;

const BLOCKED_LABEL_KEYS = {
  AI_PARSE: 'paywall.blockedLimit',
  VOICE_NOTE: 'paywall.blockedLimit',
  CHEER: 'paywall.blockedLimit',
  NUDGE: 'paywall.blockedLimit',
  FRIEND: 'paywall.blockedLimit',
  TODO_CATEGORY: 'paywall.blockedLimit',
  AI_REPORT: 'paywall.blockedLocked',
  AI_SUGGESTION: 'paywall.blockedLocked',
  CUSTOM_REMINDER_TIME: 'paywall.blockedLocked',
  APP_ICON: 'paywall.blockedLocked',
} as const satisfies Record<EntitlementFeature, string>;

export function BlockedFeature({ className }: BlockedFeatureProps) {
  const feature = useBlockedFeature();

  if (feature == null) {
    return null;
  }

  return <BlockedFeatureCard feature={feature} className={className} />;
}

function useBlockedFeature() {
  const [{ feature }] = useSubscriptionParams();

  return feature == null || hasBenefitSlide(BENEFIT_SLIDES, feature) ? null : feature;
}

/** 막힌 기능은 라우트 값으로 먼저 알아, 권한을 받는 동안에도 카드 자리를 잡아 둔다 */
BlockedFeature.Loading = function Loading({ className }: BlockedFeatureProps) {
  const feature = useBlockedFeature();

  if (feature == null) {
    return null;
  }

  return (
    <VStack gap={12} className={cn('rounded-2xl bg-main/10 p-4', className)}>
      <TextSkeleton size="e1" className="w-16 self-start" />

      <HStack gap={12} className="items-center">
        <Skeleton className="size-10 rounded-xl" />

        <VStack gap={2} className="flex-1">
          <TextSkeleton size="b3" className="w-40" />
          <TextSkeleton size="b4" className="w-52" />
        </VStack>
      </HStack>
    </VStack>
  );
};

function BlockedFeatureCard({
  feature,
  className,
}: { feature: EntitlementFeature } & Pick<ComponentProps<typeof VStack>, 'className'>) {
  const { t } = useTranslation('subscription');
  const formatBenefit = useFormatBenefit();
  const { title, description } = formatBenefit(feature);

  return (
    <VStack
      gap={12}
      className={cn('rounded-2xl bg-main/10 p-4', className)}
      testID="paywall-blocked-feature"
    >
      <Chip size="sm" variant="soft" className="self-start bg-white dark:bg-gray-2">
        <Text size="e1" weight="semibold" tone="brand">
          {t(BLOCKED_LABEL_KEYS[feature])}
        </Text>
      </Chip>

      <HStack gap={12} className="items-center">
        <PremiumFeatureIcon feature={feature} size="medium" />

        <VStack gap={2} className="flex-1">
          <Text size="b3" weight="bold" shade={9} lineBreakStrategyIOS="hangul-word">
            {title}
          </Text>
          <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
            {description}
          </Text>
        </VStack>
      </HStack>
    </VStack>
  );
}

/** 기능 하나의 혜택 제목·설명. 숫자는 서버 스냅샷(무료)과 카탈로그(프리미엄)에서 온다 */
function useFormatBenefit() {
  const { t } = useTranslation('subscription');
  const { locale } = useDateFormatContext();
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const { free, premium } = getPlanBenefitAmounts(entitlements);
  const formatAmount = (value: number) => formatCount(value, locale);

  return (feature: EntitlementFeature) =>
    match(feature)
      .with('AI_PARSE', () => ({
        title: t('benefits.aiParsing.title'),
        description: t('benefits.aiParsing.description', {
          free: formatAmount(free.aiParse),
          premium: formatAmount(premium.aiParse),
        }),
      }))
      .with('VOICE_NOTE', () => ({
        title: t('benefits.voiceNote.title', {
          premium: formatAmount(premium.voiceNote),
          premiumMinutes: formatAmount(premium.voiceNoteMinutes),
        }),
        description: t('benefits.voiceNote.description', {
          free: formatAmount(free.voiceNote),
          freeMinutes: formatAmount(free.voiceNoteMinutes),
          premium: formatAmount(premium.voiceNote),
          premiumMinutes: formatAmount(premium.voiceNoteMinutes),
        }),
      }))
      .with('NUDGE', () => ({
        title: t('benefits.nudge.title'),
        description: t('benefits.nudge.description', { free: formatAmount(free.nudge) }),
      }))
      .with('CHEER', () => ({
        title: t('benefits.cheer.title'),
        description: t('benefits.cheer.description', { free: formatAmount(free.cheer) }),
      }))
      .with('FRIEND', () => ({
        title: t('benefits.friends.title'),
        description: t('benefits.friends.description', { free: formatAmount(free.friend) }),
      }))
      .with('TODO_CATEGORY', () => ({
        title: t('benefits.categories.title', { premium: formatAmount(premium.category) }),
        description: t('benefits.categories.description', {
          free: formatAmount(free.category),
          premium: formatAmount(premium.category),
        }),
      }))
      .with('AI_REPORT', () => ({
        title: t('benefits.aiReport.title'),
        description: t('benefits.aiReport.description'),
      }))
      .with('AI_SUGGESTION', () => ({
        title: t('benefits.aiRepeat.title'),
        description: t('benefits.aiRepeat.description'),
      }))
      .with('CUSTOM_REMINDER_TIME', () => ({
        title: t('benefits.reminder.title'),
        description: t('benefits.reminder.description'),
      }))
      .with('APP_ICON', () => ({
        title: t('benefits.appIcon.title'),
        description: t('benefits.appIcon.description'),
      }))
      .exhaustive();
}

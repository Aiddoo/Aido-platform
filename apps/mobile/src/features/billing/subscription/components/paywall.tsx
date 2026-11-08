import benefitAiParsingImage from '@assets/images/subscription/benefit-ai-parsing.webp';
import benefitAppIconImage from '@assets/images/subscription/benefit-app-icon.webp';
import benefitNotificationImage from '@assets/images/subscription/benefit-notification.webp';
import benefitNudgeImage from '@assets/images/subscription/benefit-nudge.webp';
import { getLegalUrl } from '@src/shared/constants/legal-urls';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useOpenInAppBrowser } from '@src/shared/hooks/use-open-in-app-browser';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import { FeatureMedia, type FeatureMediaProps, H2, HStack, Text, VStack } from '@src/shared/ui';
import { formatCount } from '@src/shared/utils/number-format';
import { useSuspenseQuery } from '@tanstack/react-query';
import { Chip, Separator } from 'heroui-native';
import { Fragment } from 'react';
import { match } from 'ts-pattern';

import { type EntitlementFeature } from '../domains/entitlement.model';
import { UpsellPolicy } from '../domains/upsell.model';
import { useGetEntitlementsQueryOptions } from '../queries/entitlement.queries';
import { getPlanBenefitAmounts } from '../utils/plan-benefit.view-model';
import { findSubscriptionStore, type RenewalNoticeStore } from '../utils/subscription-store';
import { PremiumFeatureIcon } from './premium-feature-icon';

/** 페이월 머리글. 막힌 기능·요금제·혜택 순서는 화면이 정한다 */
export function Paywall() {
  const { t } = useTranslation('subscription');

  return (
    <VStack gap={4} className="items-center">
      <H2>{t('paywall.title')}</H2>

      <Text size="b3" shade={6} lineBreakStrategyIOS="hangul-word">
        {t('paywall.subtitle')}
      </Text>
    </VStack>
  );
}

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

/** 막혀서 들어온 기능을 요금제보다 먼저 보여 준다 */
Paywall.BlockedFeature = function BlockedFeature({ feature }: { feature: EntitlementFeature }) {
  const { t } = useTranslation('subscription');
  const formatBenefit = useFormatBenefit();
  const { title, description } = formatBenefit(feature);

  return (
    <VStack gap={12} className="rounded-2xl bg-main/10 p-4" testID="paywall-blocked-feature">
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
};

const IMAGE_BENEFITS = [
  { feature: 'AI_PARSE', image: benefitAiParsingImage },
  { feature: 'CUSTOM_REMINDER_TIME', image: benefitNotificationImage },
  { feature: 'NUDGE', image: benefitNudgeImage },
  { feature: 'APP_ICON', image: benefitAppIconImage },
] as const satisfies readonly { feature: EntitlementFeature; image: FeatureMediaProps['source'] }[];

Paywall.Benefits = function Benefits({ feature }: { feature?: EntitlementFeature }) {
  const formatBenefit = useFormatBenefit();

  return (
    <VStack gap={20}>
      {UpsellPolicy.excludeBlockedBenefit(IMAGE_BENEFITS, feature).map((benefit) => (
        <BenefitCard
          key={benefit.feature}
          {...formatBenefit(benefit.feature)}
          image={benefit.image}
        />
      ))}
    </VStack>
  );
};

const ADDITIONAL_BENEFITS = [
  { feature: 'VOICE_NOTE' },
  { feature: 'FRIEND' },
  { feature: 'TODO_CATEGORY' },
  { feature: 'AI_SUGGESTION' },
  { feature: 'AI_REPORT' },
] as const satisfies readonly { feature: EntitlementFeature }[];

Paywall.AdditionalBenefits = function AdditionalBenefits({
  feature,
}: {
  feature?: EntitlementFeature;
}) {
  const { t } = useTranslation('subscription');
  const formatBenefit = useFormatBenefit();

  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('paywall.moreBenefits')}
      </Text>

      {UpsellPolicy.excludeBlockedBenefit(ADDITIONAL_BENEFITS, feature).map((benefit, index) => (
        <Fragment key={benefit.feature}>
          {index > 0 && <Separator className="bg-gray-3" />}
          <AdditionalBenefit feature={benefit.feature} {...formatBenefit(benefit.feature)} />
        </Fragment>
      ))}
    </VStack>
  );
};

Paywall.FutureIncluded = function FutureIncluded() {
  const { t } = useTranslation('subscription');

  return (
    <Text size="e2" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
      {t('paywall.futureIncluded')}
    </Text>
  );
};

const RENEWAL_NOTICE_KEYS = {
  appStore: 'paywall.renewalNotice.appStore',
  googlePlay: 'paywall.renewalNotice.googlePlay',
} as const satisfies Record<RenewalNoticeStore, string>;

Paywall.RenewalNotice = function RenewalNotice() {
  const { t } = useTranslation('subscription');
  const store = findSubscriptionStore(process.env.EXPO_OS);

  if (store == null) {
    return null;
  }

  return (
    <Text size="e2" shade={6} align="center" lineBreakStrategyIOS="hangul-word">
      {t(RENEWAL_NOTICE_KEYS[store])}
    </Text>
  );
};

Paywall.Terms = function Terms() {
  const { t } = useTranslation('subscription');
  const openUrl = useOpenInAppBrowser();
  const { resolvedLanguage } = useLanguage();

  return (
    <Text size="e2" shade={6} align="center" lineBreakStrategyIOS="hangul-word">
      {t('paywall.termsPrefix')}
      <Text
        size="e2"
        shade={5}
        underline
        onPress={() => openUrl(getLegalUrl('terms', resolvedLanguage))}
      >
        {t('paywall.termsLink')}
      </Text>
      {t('paywall.termsAnd')}
      <Text
        size="e2"
        shade={5}
        underline
        onPress={() => openUrl(getLegalUrl('privacy', resolvedLanguage))}
      >
        {t('paywall.privacyLink')}
      </Text>
      {t('paywall.termsSuffix')}
    </Text>
  );
};

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

interface BenefitCardProps {
  title: string;
  description: string;
  image: FeatureMediaProps['source'];
}

function BenefitCard({ title, description, image }: BenefitCardProps) {
  return (
    <VStack gap={12}>
      <VStack className="flex-1">
        <Text size="b3" weight="semibold" shade={9} lineBreakStrategyIOS="hangul-word">
          {title}
        </Text>
        <Text size="b4" shade={6} lineBreakStrategyIOS="hangul-word">
          {description}
        </Text>
      </VStack>

      <FeatureMedia source={image} alt="" ratio={16 / 9} className="rounded-xl" />
    </VStack>
  );
}

interface AdditionalBenefitProps {
  feature: EntitlementFeature;
  title: string;
  description: string;
}

function AdditionalBenefit({ feature, title, description }: AdditionalBenefitProps) {
  return (
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
  );
}

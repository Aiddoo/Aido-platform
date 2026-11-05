import benefitAiParsingImage from '@assets/images/subscription/benefit-ai-parsing.webp';
import benefitAppIconImage from '@assets/images/subscription/benefit-app-icon.webp';
import benefitNotificationImage from '@assets/images/subscription/benefit-notification.webp';
import benefitNudgeImage from '@assets/images/subscription/benefit-nudge.webp';
import { useTrack } from '@src/shared/analytics';
import { legalUrl } from '@src/shared/constants/legal-urls';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useIsOnline } from '@src/shared/hooks/use-is-online';
import { useOpenUrl } from '@src/shared/hooks/use-open-url';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import {
  Box,
  Button,
  CalendarIcon,
  DashedDivider,
  DocsIcon,
  H2,
  HStack,
  ListIcon,
  MicIcon,
  PersonIcon,
  ScallopedContainer,
  Spacing,
  type StyledIconType,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { formatCount } from '@src/shared/utils/format';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Separator } from 'heroui-native';
import { useEffect, useState } from 'react';
import { Image, type ImageSourcePropType, Platform, ScrollView } from 'react-native';

import type { SubscriptionOffering } from '../domains/subscription.model';
import { useSubscriptionViewParam } from '../hooks/use-subscription-view-param';
import { useGetEntitlementsQueryOptions } from '../queries/get-entitlements-query-options';
import { usePurchaseMutationOptions } from '../queries/use-purchase-mutation-options';
import { getSubscriptionStore, type SubscriptionStore } from '../utils/subscription-store';
import { toPlanBenefitAmounts } from '../utils/view-models/plan-benefit.view-model';
import { PremiumNotice } from './premium-notice';
import { RestorePurchaseButton } from './restore-purchase-button';
import { SubscriptionOfflineActionsNotice } from './subscription-offline-actions-notice';
import { SubscriptionPlanInput } from './subscription-plan-input';

interface PaywallProps {
  offering: SubscriptionOffering;
}

/** 무료 사용자(또는 보상 기간에 구독을 이어 붙이려는 사람)의 요금제와 혜택, 결제 */
export function Paywall({ offering }: PaywallProps) {
  const { t } = useTranslation('subscription');
  const purchase = useMutation(usePurchaseMutationOptions());
  const [view] = useSubscriptionViewParam();
  const isOnline = useIsOnline();
  const { trackEvent } = useTrack();
  const [chosenPlanId, setChosenPlanId] = useState<string>();
  const defaultPlan =
    offering.plans.find((plan) => plan.planType === 'annual') ?? offering.plans[0];
  const selectedPlanId = chosenPlanId ?? defaultPlan?.identifier;
  const selectedPlan = offering.plans.find((plan) => plan.identifier === selectedPlanId);

  // 요금제를 받아 페이월이 실제로 보였을 때 한 번 센다(게이트 → 구독하기 → 페이월 → 결제 퍼널)
  useEffect(() => {
    trackEvent('paywall_viewed', { view });
  }, [trackEvent, view]);

  const handlePurchase = () => {
    if (!selectedPlan || purchase.isPending) {
      return;
    }
    purchase.mutate(selectedPlan.identifier, {
      // 보상 영수증에서 요금제로 들어왔으면 영수증으로 돌아가 결제한 영수증으로 바뀌는 것을 보여 준다
      onSuccess: () => {
        if (view === 'plans' && router.canGoBack()) {
          router.back();
        }
      },
    });
  };

  return (
    <Box className="flex-1" testID="subscription-paywall">
      <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
        <StyledSafeAreaView edges={['left', 'right']}>
          <Spacing size={16} />

          <PremiumNotice.GrantEnded />

          <ScallopedContainer>
            <Box className="px-5 pt-5">
              <VStack gap={4} className="items-center">
                <H2>{t('paywall.title')}</H2>

                <Text size="b3" shade={6} lineBreakStrategyIOS="hangul-word">
                  {t('paywall.subtitle')}
                </Text>
              </VStack>

              <DashedDivider className="my-6" />

              <Paywall.Benefits />

              <Spacing size={20} />

              <Paywall.AdditionalBenefits />

              <Spacing size={8} />

              <Text size="e2" shade={5} align="center" lineBreakStrategyIOS="hangul-word">
                {t('paywall.futureIncluded')}
              </Text>
            </Box>

            <DashedDivider className="my-5 mx-5" />

            <Box className="px-5 pb-5">
              <SubscriptionPlanInput value={selectedPlanId} onValueChange={setChosenPlanId} />
            </Box>
          </ScallopedContainer>

          <Spacing size={24} />

          <VStack gap={8} className="items-center">
            <Paywall.RenewalNotice />
            <Paywall.Terms />
            <RestorePurchaseButton size="small" />
          </VStack>
        </StyledSafeAreaView>
      </ScrollView>

      <StyledSafeAreaView edges={['left', 'right']} className="px-4 pb-4 pt-2">
        {!isOnline && (
          <Box className="pb-2">
            <SubscriptionOfflineActionsNotice />
          </Box>
        )}
        <Button
          onPress={handlePurchase}
          isLoading={purchase.isPending}
          isDisabled={!selectedPlan || purchase.isPending || !isOnline}
        >
          {t('paywall.subscribeButton')}
        </Button>
      </StyledSafeAreaView>
    </Box>
  );
}

/** 그림과 함께 보여 주는 대표 혜택. 숫자는 서버 스냅샷(무료)과 PLAN_CATALOG(프리미엄)에서 읽는다 */
Paywall.Benefits = function Benefits() {
  const { t } = useTranslation('subscription');
  const { locale } = useDateFormatContext();
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const { free, premium } = toPlanBenefitAmounts(entitlements);
  const formatAmount = (value: number) => formatCount(value, locale);

  return (
    <VStack gap={20}>
      <BenefitCard
        title={t('benefits.aiParsing.title')}
        description={t('benefits.aiParsing.description', {
          free: formatAmount(free.aiParse),
          premium: formatAmount(premium.aiParse),
        })}
        image={benefitAiParsingImage}
      />
      <BenefitCard
        title={t('benefits.nudge.title')}
        description={t('benefits.nudge.description', { free: formatAmount(free.nudge) })}
        image={benefitNudgeImage}
      />
      <BenefitCard
        title={t('benefits.reminder.title')}
        description={t('benefits.reminder.description')}
        image={benefitNotificationImage}
      />
      <BenefitCard
        title={t('benefits.appIcon.title')}
        description={t('benefits.appIcon.description')}
        image={benefitAppIconImage}
      />
    </VStack>
  );
};

Paywall.AdditionalBenefits = function AdditionalBenefits() {
  const { t } = useTranslation('subscription');
  const { locale } = useDateFormatContext();
  const { data: entitlements } = useSuspenseQuery(useGetEntitlementsQueryOptions());
  const { free, premium } = toPlanBenefitAmounts(entitlements);
  const formatAmount = (value: number) => formatCount(value, locale);

  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('paywall.moreBenefits')}
      </Text>

      <AdditionalBenefit
        Icon={MicIcon}
        title={t('benefits.voiceNote.title', {
          premium: formatAmount(premium.voiceNote),
          premiumMinutes: formatAmount(premium.voiceNoteMinutes),
        })}
        description={t('benefits.voiceNote.description', {
          free: formatAmount(free.voiceNote),
          freeMinutes: formatAmount(free.voiceNoteMinutes),
          premium: formatAmount(premium.voiceNote),
          premiumMinutes: formatAmount(premium.voiceNoteMinutes),
        })}
      />
      <Separator className="bg-gray-3" />
      <AdditionalBenefit
        Icon={PersonIcon}
        title={t('benefits.friends.title')}
        description={t('benefits.friends.description', { free: formatAmount(free.friend) })}
      />
      <Separator className="bg-gray-3" />
      <AdditionalBenefit
        Icon={ListIcon}
        title={t('benefits.categories.title', { premium: formatAmount(premium.category) })}
        description={t('benefits.categories.description', {
          free: formatAmount(free.category),
          premium: formatAmount(premium.category),
        })}
      />
      <Separator className="bg-gray-3" />
      <AdditionalBenefit
        Icon={CalendarIcon}
        title={t('benefits.aiRepeat.title')}
        description={t('benefits.aiRepeat.description')}
      />
      <Separator className="bg-gray-3" />
      <AdditionalBenefit
        Icon={DocsIcon}
        title={t('benefits.aiReport.title')}
        description={t('benefits.aiReport.description')}
      />
    </VStack>
  );
};

const RENEWAL_NOTICE_KEYS = {
  appStore: 'paywall.renewalNotice.appStore',
  googlePlay: 'paywall.renewalNotice.googlePlay',
} as const satisfies Record<SubscriptionStore, string>;

Paywall.RenewalNotice = function RenewalNotice() {
  const { t } = useTranslation('subscription');
  const store = getSubscriptionStore(Platform.OS);

  if (store == null) {
    return null;
  }

  return (
    <Text size="e2" shade={4} align="center" lineBreakStrategyIOS="hangul-word">
      {t(RENEWAL_NOTICE_KEYS[store])}
    </Text>
  );
};

Paywall.Terms = function Terms() {
  const { t } = useTranslation('subscription');
  const openUrl = useOpenUrl();
  const { resolvedLanguage } = useLanguage();

  return (
    <Text size="e2" shade={4} align="center" lineBreakStrategyIOS="hangul-word">
      {t('paywall.termsPrefix')}
      <Text
        size="e2"
        shade={5}
        underline
        onPress={() => openUrl(legalUrl('terms', resolvedLanguage))}
      >
        {t('paywall.termsLink')}
      </Text>
      {t('paywall.termsAnd')}
      <Text
        size="e2"
        shade={5}
        underline
        onPress={() => openUrl(legalUrl('privacy', resolvedLanguage))}
      >
        {t('paywall.privacyLink')}
      </Text>
      {t('paywall.termsSuffix')}
    </Text>
  );
};

interface BenefitCardProps {
  title: string;
  description: string;
  image: ImageSourcePropType;
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

      <Box className="w-full aspect-video rounded-xl overflow-hidden">
        <Image source={image} className="size-full" resizeMode="cover" />
      </Box>
    </VStack>
  );
}

interface AdditionalBenefitProps {
  Icon: StyledIconType;
  title: string;
  description: string;
}

function AdditionalBenefit({ Icon, title, description }: AdditionalBenefitProps) {
  return (
    <HStack gap={12} className="items-center">
      <Box className="bg-main/10 w-10 h-10 rounded-xl items-center justify-center">
        <Icon width={20} height={20} colorClassName="text-main" />
      </Box>

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

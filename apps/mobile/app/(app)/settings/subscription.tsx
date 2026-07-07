import benefitAiParsingImage from '@assets/images/subscription/benefit-ai-parsing.webp';
import benefitAppIconImage from '@assets/images/subscription/benefit-app-icon.webp';
import benefitNotificationImage from '@assets/images/subscription/benefit-notification.webp';
import benefitNudgeImage from '@assets/images/subscription/benefit-nudge.webp';
import { useRevenueCatSdkManager } from '@src/bootstrap/providers/di-context';
import { ScallopedContainer } from '@src/features/ai/presentations/components/ScallopedContainer';
import {
  isActiveSubscription,
  SubscriptionPolicy,
} from '@src/features/subscription/models/subscription.model';
import { SubscriptionPlanCard } from '@src/features/subscription/presentations/components/SubscriptionPlanCard';
import { useGetOfferingsQueryOptions } from '@src/features/subscription/presentations/queries/use-get-offerings-query-options';
import { usePurchaseMutationOptions } from '@src/features/subscription/presentations/queries/use-purchase-mutation-options';
import { useRestoreMutationOptions } from '@src/features/subscription/presentations/queries/use-restore-mutation-options';
import { UserPolicy } from '@src/features/user/models/user.model';
import { useGetMeQueryOptions } from '@src/features/user/presentations/queries/use-get-me-query-options';
import { LEGAL_URLS } from '@src/shared/constants/legal-urls.constant';
import { STORE_URLS } from '@src/shared/constants/store-urls.constant';
import { useOpenUrl } from '@src/shared/hooks/useOpenUrl';
import { useTranslation } from '@src/shared/i18n';
import {
  BellIcon,
  Button,
  CalendarIcon,
  DeviceIcon,
  DocsIcon,
  FillCheckIcon,
  FillTicketIcon,
  H2,
  HStack,
  ListIcon,
  ListRow,
  PersonIcon,
  QueryErrorBoundary,
  Result,
  SendIcon,
  Spacing,
  StyledSafeAreaView,
  Text,
  TextButton,
  VStack,
} from '@src/shared/ui';
import { formatFullDate } from '@src/shared/utils/date';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Separator, Spinner } from 'heroui-native';
import { Suspense, useState } from 'react';
import { Image, Linking, ScrollView, View } from 'react-native';

/** 이미지가 있는 핵심 프리미엄 기능 (문구는 subscription 카탈로그 키) */
const HIGHLIGHT_BENEFITS = [
  {
    icon: DocsIcon,
    titleKey: 'benefits.aiParsing.title',
    descriptionKey: 'benefits.aiParsing.description',
    image: benefitAiParsingImage,
  },
  {
    icon: SendIcon,
    titleKey: 'benefits.nudge.title',
    descriptionKey: 'benefits.nudge.description',
    image: benefitNudgeImage,
  },
  {
    icon: BellIcon,
    titleKey: 'benefits.reminder.title',
    descriptionKey: 'benefits.reminder.description',
    image: benefitNotificationImage,
  },
  {
    icon: DeviceIcon,
    titleKey: 'benefits.appIcon.title',
    descriptionKey: 'benefits.appIcon.description',
    image: benefitAppIconImage,
  },
] as const;

/** 이미지 없는 추가 프리미엄 기능 (문구는 subscription 카탈로그 키) */
const EXTRA_BENEFITS = [
  {
    icon: PersonIcon,
    titleKey: 'benefits.friends.title',
    descriptionKey: 'benefits.friends.description',
  },
  {
    icon: ListIcon,
    titleKey: 'benefits.categories.title',
    descriptionKey: 'benefits.categories.description',
  },
  {
    icon: CalendarIcon,
    titleKey: 'benefits.aiRepeat.title',
    descriptionKey: 'benefits.aiRepeat.description',
  },
  {
    icon: DocsIcon,
    titleKey: 'benefits.aiReport.title',
    descriptionKey: 'benefits.aiReport.description',
  },
] as const;

/** 구독자 체크리스트용 전체 혜택 제목 키 */
const ALL_BENEFIT_TITLE_KEYS = [
  ...HIGHLIGHT_BENEFITS.map((b) => b.titleKey),
  ...EXTRA_BENEFITS.map((b) => b.titleKey),
];

const SubscriptionScreen = () => {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <QueryErrorBoundary>
        <Suspense
          fallback={
            <View className="flex-1 items-center justify-center">
              <Spinner size="lg" color="default" />
            </View>
          }
        >
          <SubscriptionContent />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
};

export default SubscriptionScreen;

function SubscriptionContent() {
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const isPremium = UserPolicy.isPremiumUser(user);

  if (isPremium) {
    return <SubscriberView />;
  }

  return <NonSubscriberView />;
}

function SubscriberView() {
  const { t } = useTranslation('subscription');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const restore = useMutation(useRestoreMutationOptions());

  const isActive = isActiveSubscription(user.subscriptionStatus);

  const showDetails = SubscriptionPolicy.shouldShowExpirationDetails(
    user.subscriptionStatus,
    user.subscriptionExpiresAt,
  );

  const handleManageSubscription = () => {
    if (STORE_URLS.SUBSCRIPTION_MANAGEMENT) {
      Linking.openURL(STORE_URLS.SUBSCRIPTION_MANAGEMENT);
    }
  };

  return (
    <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
      <Spacing size={16} />

      <ScallopedContainer>
        <View className="px-5 pt-5">
          <HStack gap={16} className="items-center">
            <FillTicketIcon width={40} height={40} />

            <VStack gap={2}>
              <Text size="t3" weight="bold" tone="brand">
                {t('subscriber.title')}
              </Text>

              <Text size="b4" shade={6}>
                {t('subscriber.description')}
              </Text>
            </VStack>
          </HStack>

          <Spacing size={24} />

          {showDetails && (
            <VStack>
              <ListRow
                verticalPadding="small"
                contents={
                  <Text size="b4" shade={6}>
                    {isActive ? t('status.nextBillingDate') : t('status.expiresAt')}
                  </Text>
                }
                right={
                  <Text size="b4" weight="semibold" shade={8}>
                    {user.subscriptionExpiresAt && formatFullDate(user.subscriptionExpiresAt)}
                  </Text>
                }
              />

              {isActive && (
                <ListRow
                  verticalPadding="small"
                  contents={
                    <Text size="b4" shade={6}>
                      {t('status.statusLabel')}
                    </Text>
                  }
                  right={
                    <Text size="b4" weight="semibold" tone="brand">
                      {t('status.autoRenewal')}
                    </Text>
                  }
                />
              )}
            </VStack>
          )}
        </View>

        <View className="my-5 border-b border-dashed border-gray-3 mx-5" />

        <View className="px-5">
          <Text size="b3" weight="semibold" shade={9} className="mb-3">
            {t('subscriber.benefitsTitle')}
          </Text>

          <VStack gap={2}>
            {ALL_BENEFIT_TITLE_KEYS.map((titleKey) => (
              <ListRow
                key={titleKey}
                verticalPadding="small"
                left={
                  <View className="bg-main w-5 h-5 rounded-full items-center justify-center">
                    <FillCheckIcon width={12} height={12} colorClassName="text-white" />
                  </View>
                }
                contents={
                  <Text size="b3" shade={8}>
                    {t(titleKey)}
                  </Text>
                }
              />
            ))}
            <ListRow
              verticalPadding="small"
              left={
                <View className="bg-main w-5 h-5 rounded-full items-center justify-center">
                  <FillCheckIcon width={12} height={12} colorClassName="text-white" />
                </View>
              }
              contents={
                <Text size="b3" shade={8}>
                  {t('benefits.future')}
                </Text>
              }
            />
          </VStack>
        </View>

        <View className="my-5 border-b border-dashed border-gray-3 mx-5" />

        <View className="px-5 pb-5 items-center">
          <ReceiptBarcode />
        </View>
      </ScallopedContainer>

      <Spacing size={16} />

      <Button onPress={handleManageSubscription} variant="weak" color="dark">
        {t('subscriber.manageButton')}
      </Button>

      <Spacing size={16} />

      <View className="items-center">
        <TextButton
          size="medium"
          variant="underline"
          onPress={() => restore.mutate()}
          isDisabled={restore.isPending}
        >
          {t('subscriber.restoreButton')}
        </TextButton>
      </View>
    </ScrollView>
  );
}

function NonSubscriberView() {
  const sdkManager = useRevenueCatSdkManager();

  if (!sdkManager.isConfigured()) {
    return <SubscriptionUnavailableView />;
  }

  return <OfferingsView />;
}

function SubscriptionUnavailableView() {
  const { t } = useTranslation('subscription');

  return (
    <Result
      icon={<DocsIcon width={72} height={72} />}
      title={t('paywall.unavailableTitle')}
      description={t('paywall.unavailableDescription')}
    />
  );
}

function OfferingsView() {
  const { t } = useTranslation('subscription');
  const { data: offering } = useSuspenseQuery(useGetOfferingsQueryOptions());

  const purchase = useMutation(usePurchaseMutationOptions());

  const restore = useMutation(useRestoreMutationOptions());

  const annualPlan = offering.plans.find((p) => p.planType === 'annual');
  const defaultPlan = annualPlan ?? offering.plans[0];

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    defaultPlan?.identifier ?? null,
  );

  const selectedPlan = offering.plans.find((p) => p.identifier === selectedPlanId);

  const handlePurchase = () => {
    if (!selectedPlan) {
      return;
    }

    purchase.mutate(selectedPlan.identifier);
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
        <Spacing size={16} />

        <ScallopedContainer>
          <View className="px-5 pt-5">
            <VStack gap={4} className="items-center">
              <H2>{t('paywall.title')}</H2>

              <Text size="b3" shade={6}>
                {t('paywall.subtitle')}
              </Text>
            </VStack>

            <View className="my-6 border-b border-dashed border-gray-3" />

            <VStack gap={20}>
              {HIGHLIGHT_BENEFITS.map((benefit) => (
                <BenefitCard key={benefit.titleKey} benefit={benefit} />
              ))}
            </VStack>

            <Spacing size={20} />

            <ExtraBenefitCard />

            <Spacing size={8} />

            <Text size="e2" shade={5} align="center">
              {t('paywall.futureIncluded')}
            </Text>
          </View>

          <View className="my-5 border-b border-dashed border-gray-3 mx-5" />

          <View className="px-5 pb-5">
            <SubscriptionPlanCard
              plans={offering.plans}
              selectedPlanId={selectedPlanId}
              onPlanSelect={setSelectedPlanId}
            />
          </View>
        </ScallopedContainer>

        <Spacing size={24} />

        <VStack gap={8} className="items-center">
          <TermsNotice />
          <TextButton
            size="small"
            variant="underline"
            onPress={() => restore.mutate()}
            isDisabled={restore.isPending}
          >
            {t('subscriber.restoreButton')}
          </TextButton>
        </VStack>
      </ScrollView>

      <View className="px-4 pb-4 pt-2">
        <Button
          onPress={handlePurchase}
          isLoading={purchase.isPending}
          isDisabled={!selectedPlan || purchase.isPending}
        >
          {t('paywall.subscribeButton')}
        </Button>
      </View>
    </View>
  );
}

function BenefitCard({ benefit }: { benefit: (typeof HIGHLIGHT_BENEFITS)[number] }) {
  const { t } = useTranslation('subscription');

  return (
    <VStack gap={12}>
      <VStack className="flex-1">
        <Text size="b3" weight="semibold" shade={9}>
          {t(benefit.titleKey)}
        </Text>
        <Text size="b4" shade={6}>
          {t(benefit.descriptionKey)}
        </Text>
      </VStack>

      <View className="w-full aspect-video rounded-xl overflow-hidden">
        <Image source={benefit.image} className="size-full" resizeMode="cover" />
      </View>
    </VStack>
  );
}

function ExtraBenefitCard() {
  const { t } = useTranslation('subscription');

  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('paywall.moreBenefits')}
      </Text>

      {EXTRA_BENEFITS.map((benefit, index) => {
        const Icon = benefit.icon;

        return (
          <View key={benefit.titleKey}>
            {index > 0 && <Separator className="bg-gray-2 dark:bg-gray-3 mb-4" />}
            <HStack gap={12} className="items-center">
              <View className="bg-main/10 w-10 h-10 rounded-xl items-center justify-center">
                <Icon width={20} height={20} colorClassName="text-main" />
              </View>

              <VStack gap={2} className="flex-1">
                <Text size="b3" weight="bold" shade={9}>
                  {t(benefit.titleKey)}
                </Text>

                <Text size="b4" shade={6}>
                  {t(benefit.descriptionKey)}
                </Text>
              </VStack>
            </HStack>
          </View>
        );
      })}
    </VStack>
  );
}

function TermsNotice() {
  const { t } = useTranslation('subscription');
  const openUrl = useOpenUrl();

  return (
    <Text size="e2" shade={4} align="center">
      {t('paywall.termsPrefix')}
      <Text size="e2" shade={5} underline onPress={() => openUrl(LEGAL_URLS.TERMS)}>
        {t('paywall.termsLink')}
      </Text>
      {t('paywall.termsAnd')}
      <Text size="e2" shade={5} underline onPress={() => openUrl(LEGAL_URLS.PRIVACY)}>
        {t('paywall.privacyLink')}
      </Text>
      {t('paywall.termsSuffix')}
    </Text>
  );
}

/** 영수증 하단 바코드 장식 */
const BARCODE_BARS = [
  4, 1, 3, 1, 2, 1, 1, 3, 1, 2, 3, 1, 1, 2, 1, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 1,
  2, 1, 1, 3, 1, 2, 1, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3,
] as const;

function ReceiptBarcode() {
  return (
    <View className="flex-row items-end justify-center gap-[1.5px]">
      {BARCODE_BARS.map((w, i) => (
        <View
          // biome-ignore lint/suspicious/noArrayIndexKey: <단순 ui 장식용>
          key={i}
          className="bg-gray-7 rounded-[0.5px]"
          style={{ width: w * 1.8, height: 32 }}
        />
      ))}
    </View>
  );
}

import benefitAiParsingImage from '@assets/images/subscription/benefit-ai-parsing.webp';
import benefitAppIconImage from '@assets/images/subscription/benefit-app-icon.webp';
import benefitNotificationImage from '@assets/images/subscription/benefit-notification.webp';
import benefitNudgeImage from '@assets/images/subscription/benefit-nudge.webp';
import { useRevenueCatSdkManager } from '@src/bootstrap/providers/di-context';
import { ScallopedContainer } from '@src/features/ai/components/scalloped-container';
import { SubscriptionPlanCard } from '@src/features/subscription/components/subscription-plan-card';
import {
  isActiveSubscription,
  SubscriptionPolicy,
} from '@src/features/subscription/domains/subscription.model';
import { useGetOfferingsQueryOptions } from '@src/features/subscription/queries/get-offerings-query-options';
import { usePurchaseMutationOptions } from '@src/features/subscription/queries/use-purchase-mutation-options';
import { useRestoreMutationOptions } from '@src/features/subscription/queries/use-restore-mutation-options';
import { UserPolicy, type User } from '@src/features/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { LEGAL_URLS } from '@src/shared/constants/legal-urls';
import { STORE_URLS } from '@src/shared/constants/store-urls';
import { useOpenUrl } from '@src/shared/hooks/use-open-url';
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
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { Separator, Spinner } from 'heroui-native';
import { Suspense, useState } from 'react';
import { Image, Linking, ScrollView, View } from 'react-native';
import { match, P } from 'ts-pattern';

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

function SubscriptionScreen() {
  const { t } = useTranslation('subscription');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const sdkManager = useRevenueCatSdkManager();
  const isPremium = UserPolicy.isPremiumUser(user);
  const isStoreConfigured = sdkManager.isConfigured();
  const canPurchase = !isPremium && isStoreConfigured;
  const { data: offering } = useQuery({
    ...useGetOfferingsQueryOptions(),
    enabled: canPurchase,
    throwOnError: (_error, query) => canPurchase && query.state.data === undefined,
  });
  const purchase = useMutation(usePurchaseMutationOptions());
  const restore = useMutation(useRestoreMutationOptions());
  const [chosenPlanId, setChosenPlanId] = useState<string | null>(null);
  const defaultPlan =
    offering?.plans.find((plan) => plan.planType === 'annual') ?? offering?.plans[0];
  const selectedPlanId = chosenPlanId ?? defaultPlan?.identifier ?? null;
  const selectedPlan = offering?.plans.find((plan) => plan.identifier === selectedPlanId);

  const handlePurchase = () => {
    if (!canPurchase || !selectedPlan || purchase.isPending) {
      return;
    }
    purchase.mutate(selectedPlan.identifier);
  };

  const handleManageSubscription = () => {
    if (STORE_URLS.SUBSCRIPTION_MANAGEMENT) {
      return Linking.openURL(STORE_URLS.SUBSCRIPTION_MANAGEMENT);
    }
  };

  return match({ isPremium, isStoreConfigured, offering })
    .with({ isPremium: true }, () => (
      <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
        <Spacing size={16} />

        <SubscriptionReceipt user={user} />

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
    ))
    .with({ isStoreConfigured: false }, () => (
      <Result
        icon={<DocsIcon width={72} height={72} />}
        title={t('paywall.unavailableTitle')}
        description={t('paywall.unavailableDescription')}
      />
    ))
    .with({ offering: P.nullish }, () => <SubscriptionScreen.Loading />)
    .with({ offering: P.nonNullable }, ({ offering }) => (
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
                  <SubscriptionBenefitCard key={benefit.titleKey} benefit={benefit} />
                ))}
              </VStack>

              <Spacing size={20} />

              <AdditionalSubscriptionBenefits />

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
                onPlanSelect={setChosenPlanId}
              />
            </View>
          </ScallopedContainer>

          <Spacing size={24} />

          <VStack gap={8} className="items-center">
            <SubscriptionTerms />
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
    ))
    .exhaustive();
}

SubscriptionScreen.Loading = function Loading() {
  return (
    <View className="flex-1 items-center justify-center">
      <Spinner size="lg" color="default" />
    </View>
  );
};

function SubscriptionReceipt({ user }: { user: User }) {
  const { t } = useTranslation('subscription');
  const isActive = isActiveSubscription(user.subscriptionStatus);
  const showDetails = SubscriptionPolicy.isExpirationRelevant(user);

  return (
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

        {showDetails && user.subscriptionExpiresAt && (
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
  );
}

function SubscriptionBenefitCard({ benefit }: { benefit: (typeof HIGHLIGHT_BENEFITS)[number] }) {
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

function AdditionalSubscriptionBenefits() {
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

function SubscriptionTerms() {
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
          // 순서와 개수가 고정된 장식 요소이므로 index가 안정적인 key다.
          key={i}
          className="bg-gray-7 rounded-[0.5px]"
          style={{ width: w * 1.8, height: 32 }}
        />
      ))}
    </View>
  );
}

export default function SubscriptionRoute() {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <QueryErrorBoundary>
        <Suspense fallback={<SubscriptionScreen.Loading />}>
          <SubscriptionScreen />
        </Suspense>
      </QueryErrorBoundary>
    </StyledSafeAreaView>
  );
}

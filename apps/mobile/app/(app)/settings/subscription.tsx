import benefitAiParsingImage from '@assets/images/subscription/benefit-ai-parsing.webp';
import benefitAppIconImage from '@assets/images/subscription/benefit-app-icon.webp';
import benefitNotificationImage from '@assets/images/subscription/benefit-notification.webp';
import benefitNudgeImage from '@assets/images/subscription/benefit-nudge.webp';
import { useRevenueCatSdkManager } from '@src/bootstrap/providers/di-context';
import { SubscriptionPlanInput } from '@src/features/subscription/components/subscription-plan-input';
import {
  isActiveSubscription,
  SubscriptionPolicy,
} from '@src/features/subscription/domains/subscription.model';
import { useGetOfferingsQueryOptions } from '@src/features/subscription/queries/get-offerings-query-options';
import { usePurchaseMutationOptions } from '@src/features/subscription/queries/use-purchase-mutation-options';
import { useRestoreMutationOptions } from '@src/features/subscription/queries/use-restore-mutation-options';
import { UserPolicy } from '@src/features/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { LEGAL_URLS } from '@src/shared/constants/legal-urls';
import { STORE_URLS } from '@src/shared/constants/store-urls';
import { useOpenUrl } from '@src/shared/hooks/use-open-url';
import { useTranslation } from '@src/shared/i18n';
import {
  Button,
  CalendarIcon,
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
  Spacing,
  type StyledIconType,
  StyledSafeAreaView,
  Text,
  TextButton,
  VStack,
  DashedDivider,
  ScallopedContainer,
  Box,
} from '@src/shared/ui';
import { formatFullDate } from '@src/shared/utils/date';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { Separator, Spinner } from 'heroui-native';
import { Suspense, useState } from 'react';
import { Image, type ImageSourcePropType, ScrollView } from 'react-native';
import { match } from 'ts-pattern';

function SubscriptionScreen() {
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const sdkManager = useRevenueCatSdkManager();

  return match({
    isPremium: UserPolicy.isPremiumUser(user),
    isStoreConfigured: sdkManager.isConfigured(),
  })
    .with({ isPremium: true }, () => <SubscriberPane />)
    .with({ isStoreConfigured: false }, () => <StoreUnavailablePane />)
    .with({ isPremium: false, isStoreConfigured: true }, () => <PaywallPane />)
    .exhaustive();
}

function SubscriberPane() {
  const { t } = useTranslation('subscription');
  const restore = useMutation(useRestoreMutationOptions());

  const handleManageSubscription = () => {
    if (STORE_URLS.SUBSCRIPTION_MANAGEMENT) {
      return Linking.openURL(STORE_URLS.SUBSCRIPTION_MANAGEMENT);
    }
  };

  return (
    <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
      <StyledSafeAreaView edges={['left', 'right']}>
        <Spacing size={16} />

        <QueryErrorBoundary>
          <Suspense fallback={<SubscriptionScreen.Loading />}>
            <SubscriptionReceipt />
          </Suspense>
        </QueryErrorBoundary>

        <Spacing size={16} />

        <Button onPress={handleManageSubscription} variant="weak" color="dark">
          {t('subscriber.manageButton')}
        </Button>

        <Spacing size={16} />

        <Box className="items-center">
          <TextButton
            size="medium"
            variant="underline"
            onPress={() => restore.mutate()}
            isDisabled={restore.isPending}
          >
            {t('subscriber.restoreButton')}
          </TextButton>
        </Box>
      </StyledSafeAreaView>
    </ScrollView>
  );
}

function StoreUnavailablePane() {
  const { t } = useTranslation('subscription');

  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
      <Result
        icon={<DocsIcon width={72} height={72} />}
        title={t('paywall.unavailableTitle')}
        description={t('paywall.unavailableDescription')}
      />
    </StyledSafeAreaView>
  );
}

function PaywallPane() {
  const { t } = useTranslation('subscription');
  const { data: offering } = useQuery({
    ...useGetOfferingsQueryOptions(),
    throwOnError: (_error, query) => query.state.data == null,
  });
  const purchase = useMutation(usePurchaseMutationOptions());
  const restore = useMutation(useRestoreMutationOptions());
  const [chosenPlanId, setChosenPlanId] = useState<string>();
  const defaultPlan =
    offering?.plans.find((plan) => plan.planType === 'annual') ?? offering?.plans[0];
  const selectedPlanId = chosenPlanId ?? defaultPlan?.identifier;
  const selectedPlan = offering?.plans.find((plan) => plan.identifier === selectedPlanId);

  const handlePurchase = () => {
    if (!selectedPlan || purchase.isPending) {
      return;
    }
    purchase.mutate(selectedPlan.identifier);
  };

  if (offering == null) {
    return <SubscriptionScreen.Loading />;
  }

  return (
    <Box className="flex-1">
      <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
        <StyledSafeAreaView edges={['left', 'right']}>
          <Spacing size={16} />

          <ScallopedContainer>
            <Box className="px-5 pt-5">
              <VStack gap={4} className="items-center">
                <H2>{t('paywall.title')}</H2>

                <Text size="b3" shade={6}>
                  {t('paywall.subtitle')}
                </Text>
              </VStack>

              <DashedDivider className="my-6" />

              <VStack gap={20}>
                <SubscriptionBenefitCard
                  title={t('benefits.aiParsing.title')}
                  description={t('benefits.aiParsing.description')}
                  image={benefitAiParsingImage}
                />
                <SubscriptionBenefitCard
                  title={t('benefits.nudge.title')}
                  description={t('benefits.nudge.description')}
                  image={benefitNudgeImage}
                />
                <SubscriptionBenefitCard
                  title={t('benefits.reminder.title')}
                  description={t('benefits.reminder.description')}
                  image={benefitNotificationImage}
                />
                <SubscriptionBenefitCard
                  title={t('benefits.appIcon.title')}
                  description={t('benefits.appIcon.description')}
                  image={benefitAppIconImage}
                />
              </VStack>

              <Spacing size={20} />

              <AdditionalSubscriptionBenefits />

              <Spacing size={8} />

              <Text size="e2" shade={5} align="center">
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
        </StyledSafeAreaView>
      </ScrollView>

      <StyledSafeAreaView edges={['left', 'right']} className="px-4 pb-4 pt-2">
        <Button
          onPress={handlePurchase}
          isLoading={purchase.isPending}
          isDisabled={!selectedPlan || purchase.isPending}
        >
          {t('paywall.subscribeButton')}
        </Button>
      </StyledSafeAreaView>
    </Box>
  );
}

SubscriptionScreen.Loading = function Loading() {
  return (
    <StyledSafeAreaView edges={['left', 'right']} className="flex-1 items-center justify-center">
      <Spinner size="lg" color="default" />
    </StyledSafeAreaView>
  );
};

function SubscriptionReceipt() {
  const { t } = useTranslation('subscription');
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const isActive = isActiveSubscription(user.subscriptionStatus);
  const showDetails = SubscriptionPolicy.isExpirationRelevant(user);

  return (
    <ScallopedContainer>
      <Box className="px-5 pt-5">
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
      </Box>

      <DashedDivider className="my-5 mx-5" />

      <Box className="px-5">
        <Text size="b3" weight="semibold" shade={9} className="mb-3">
          {t('subscriber.benefitsTitle')}
        </Text>

        <VStack gap={2}>
          <ReceiptBenefitRow title={t('benefits.aiParsing.title')} />
          <ReceiptBenefitRow title={t('benefits.nudge.title')} />
          <ReceiptBenefitRow title={t('benefits.reminder.title')} />
          <ReceiptBenefitRow title={t('benefits.appIcon.title')} />
          <ReceiptBenefitRow title={t('benefits.friends.title')} />
          <ReceiptBenefitRow title={t('benefits.categories.title')} />
          <ReceiptBenefitRow title={t('benefits.aiRepeat.title')} />
          <ReceiptBenefitRow title={t('benefits.aiReport.title')} />
          <ReceiptBenefitRow title={t('benefits.future')} />
        </VStack>
      </Box>

      <DashedDivider className="my-5 mx-5" />

      <Box className="px-5 pb-5 items-center">
        <ReceiptBarcode />
      </Box>
    </ScallopedContainer>
  );
}

function ReceiptBenefitRow({ title }: { title: string }) {
  return (
    <ListRow
      verticalPadding="small"
      left={
        <Box className="bg-main w-5 h-5 rounded-full items-center justify-center">
          <FillCheckIcon width={12} height={12} colorClassName="text-white" />
        </Box>
      }
      contents={
        <Text size="b3" shade={8}>
          {title}
        </Text>
      }
    />
  );
}

interface SubscriptionBenefitCardProps {
  title: string;
  description: string;
  image: ImageSourcePropType;
}

function SubscriptionBenefitCard({ title, description, image }: SubscriptionBenefitCardProps) {
  return (
    <VStack gap={12}>
      <VStack className="flex-1">
        <Text size="b3" weight="semibold" shade={9}>
          {title}
        </Text>
        <Text size="b4" shade={6}>
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
        <Text size="b3" weight="bold" shade={9}>
          {title}
        </Text>

        <Text size="b4" shade={6}>
          {description}
        </Text>
      </VStack>
    </HStack>
  );
}

function AdditionalSubscriptionBenefits() {
  const { t } = useTranslation('subscription');

  return (
    <VStack gap={16}>
      <Text size="b3" weight="semibold" shade={9}>
        {t('paywall.moreBenefits')}
      </Text>

      <AdditionalBenefit
        Icon={PersonIcon}
        title={t('benefits.friends.title')}
        description={t('benefits.friends.description')}
      />
      <Separator className="bg-gray-2 dark:bg-gray-3" />
      <AdditionalBenefit
        Icon={ListIcon}
        title={t('benefits.categories.title')}
        description={t('benefits.categories.description')}
      />
      <Separator className="bg-gray-2 dark:bg-gray-3" />
      <AdditionalBenefit
        Icon={CalendarIcon}
        title={t('benefits.aiRepeat.title')}
        description={t('benefits.aiRepeat.description')}
      />
      <Separator className="bg-gray-2 dark:bg-gray-3" />
      <AdditionalBenefit
        Icon={DocsIcon}
        title={t('benefits.aiReport.title')}
        description={t('benefits.aiReport.description')}
      />
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
    <HStack align="end" justify="center" gap={1.5}>
      {BARCODE_BARS.map((w, i) => (
        <Box
          // 순서와 개수가 고정된 장식 요소이므로 index가 안정적인 key다.
          key={i}
          className="bg-gray-7 rounded-[0.5px]"
          style={{ width: w * 1.8, height: 32 }}
        />
      ))}
    </HStack>
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

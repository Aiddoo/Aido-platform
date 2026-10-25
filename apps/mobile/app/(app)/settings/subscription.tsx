import benefitAiParsingImage from '@assets/images/subscription/benefit-ai-parsing.webp';
import benefitAppIconImage from '@assets/images/subscription/benefit-app-icon.webp';
import benefitNotificationImage from '@assets/images/subscription/benefit-notification.webp';
import benefitNudgeImage from '@assets/images/subscription/benefit-nudge.webp';
import { useRevenueCatSdkManager } from '@src/bootstrap/providers/di-context';
import { SubscriptionPlanInput } from '@src/features/subscription/components/subscription-plan-input';
import { useSubscriptionReceipt } from '@src/features/subscription/hooks/use-subscription-receipt';
import { useSubscriptionViewParam } from '@src/features/subscription/hooks/use-subscription-view-param';
import { useGetOfferingsQueryOptions } from '@src/features/subscription/queries/get-offerings-query-options';
import { usePurchaseMutationOptions } from '@src/features/subscription/queries/use-purchase-mutation-options';
import { useRestoreMutationOptions } from '@src/features/subscription/queries/use-restore-mutation-options';
import type { SubscriptionReceiptRow } from '@src/features/subscription/utils/view-models/subscription-receipt.view-model';
import { UserPolicy } from '@src/features/user/domains/user.model';
import { useGetMeQueryOptions } from '@src/features/user/queries/get-me-query-options';
import { LEGAL_URLS } from '@src/shared/constants/legal-urls';
import { STORE_URLS } from '@src/shared/constants/store-urls';
import { useOpenUrl } from '@src/shared/hooks/use-open-url';
import { useTranslation } from '@src/shared/i18n';
import {
  Barcode,
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
import { formatFullDate, formatMonthDay } from '@src/shared/utils/date';
import { useMutation, useQuery, useSuspenseQuery } from '@tanstack/react-query';
import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { Separator, Spinner } from 'heroui-native';
import { Suspense, useState } from 'react';
import { Image, type ImageSourcePropType, ScrollView } from 'react-native';
import { match } from 'ts-pattern';

function SubscriptionScreen() {
  const { data: user } = useSuspenseQuery(useGetMeQueryOptions());
  const sdkManager = useRevenueCatSdkManager();
  const receipt = useSubscriptionReceipt();
  const [view] = useSubscriptionViewParam();

  // 보상 기간만 있으면 끝나기 전에 구독을 이어 붙일 수 있게 요금제를 보여 준다
  return match({
    isPremium: UserPolicy.isPremiumUser(user),
    canSubscribe: receipt.primaryAction === 'subscribe',
    isStoreConfigured: sdkManager.isConfigured(),
    view,
  })
    .with({ canSubscribe: true, view: 'plans' }, () => <PaywallPane />)
    .with({ isPremium: true }, () => <SubscriberPane />)
    .with({ isStoreConfigured: false }, () => <StoreUnavailablePane />)
    .with({ isPremium: false, isStoreConfigured: true }, () => <PaywallPane />)
    .exhaustive();
}

function SubscriberPane() {
  const { t } = useTranslation('subscription');
  const { primaryAction } = useSubscriptionReceipt();
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

        <PremiumEndingNotice />

        <QueryErrorBoundary>
          <Suspense fallback={<SubscriptionScreen.Loading />}>
            <SubscriptionReceipt />
          </Suspense>
        </QueryErrorBoundary>

        <Spacing size={16} />

        {match(primaryAction)
          .with('subscribe', () => (
            <Button
              onPress={() =>
                router.push({ pathname: '/settings/subscription', params: { view: 'plans' } })
              }
            >
              {t('subscriber.subscribeAfterGrantButton')}
            </Button>
          ))
          .with('manage', () => (
            <Button onPress={handleManageSubscription} variant="weak" color="dark">
              {t('subscriber.manageButton')}
            </Button>
          ))
          .with(null, () => null)
          .exhaustive()}

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
  const [view] = useSubscriptionViewParam();
  const [chosenPlanId, setChosenPlanId] = useState<string>();
  const defaultPlan =
    offering?.plans.find((plan) => plan.planType === 'annual') ?? offering?.plans[0];
  const selectedPlanId = chosenPlanId ?? defaultPlan?.identifier;
  const selectedPlan = offering?.plans.find((plan) => plan.identifier === selectedPlanId);

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
  const { variant, rows, footnote } = useSubscriptionReceipt();
  // 결제 기간은 해를 넘길 수 있어 연도까지, 보상 기간은 길어야 몇 달이라 월·일만 보인다
  const formatReceiptDate = variant === 'paid' ? formatFullDate : formatMonthDay;

  return (
    <ScallopedContainer>
      <Box className="px-5 pt-5">
        <HStack gap={16} className="items-center">
          <FillTicketIcon width={40} height={40} />

          <VStack gap={2} className="flex-1">
            <Text size="t3" weight="bold" tone="brand">
              {t(`receipt.${variant}.title`)}
            </Text>

            <Text size="b4" shade={6}>
              {t(`receipt.${variant}.description`)}
            </Text>
          </VStack>
        </HStack>

        <Spacing size={24} />

        <VStack>
          {rows.map((row) => (
            <ReceiptDetailRow key={row.type} row={row} formatDate={formatReceiptDate} />
          ))}
        </VStack>

        {footnote != null && (
          <Text size="e1" shade={6} lineBreakStrategyIOS="hangul-word" className="mt-2">
            {match(footnote)
              .with({ type: 'returnsToFreePlan' }, ({ date }) =>
                t('receipt.footnote.returnsToFreePlan', { date: formatReceiptDate(date) }),
              )
              .with({ type: 'rewardStartsAfterSubscription' }, ({ days }) =>
                t('receipt.footnote.rewardStartsAfterSubscription', { count: days }),
              )
              .with({ type: 'manageAutoRenewalInStore' }, () =>
                t('receipt.footnote.manageAutoRenewalInStore'),
              )
              .exhaustive()}
          </Text>
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

      <Barcode className="px-5 pb-5" />
    </ScallopedContainer>
  );
}

interface ReceiptDetailRowProps {
  row: SubscriptionReceiptRow;
  formatDate: (date: Date) => string;
}

type ReceiptValueTone = 'default' | 'brand' | 'muted';

function ReceiptDetailRow({ row, formatDate }: ReceiptDetailRowProps) {
  const { t } = useTranslation('subscription');
  const { label, value, tone } = match<
    SubscriptionReceiptRow,
    { label: string; value: string; tone: ReceiptValueTone }
  >(row)
    .with({ type: 'account' }, () => ({
      label: t('receipt.rows.account'),
      value: t('receipt.rows.accountAdmin'),
      tone: 'default',
    }))
    .with({ type: 'rewardRecord' }, ({ endsAt }) => ({
      label: t('receipt.rows.rewardRecord'),
      value: t('receipt.rows.until', { date: formatDate(endsAt) }),
      tone: 'default',
    }))
    .with({ type: 'nextBillingDate' }, ({ date }) => ({
      label: t('receipt.rows.nextBillingDate'),
      value: formatDate(date),
      tone: 'default',
    }))
    .with({ type: 'subscriptionEndsOn' }, ({ date }) => ({
      label: t('receipt.rows.subscriptionEndsOn'),
      value: formatDate(date),
      tone: 'default',
    }))
    .with({ type: 'autoRenewal' }, ({ willRenew }) => ({
      label: t('receipt.rows.subscriptionStatus'),
      value: willRenew ? t('receipt.rows.autoRenewalOn') : t('receipt.rows.autoRenewalOff'),
      tone: willRenew ? 'brand' : 'muted',
    }))
    .with({ type: 'rewardPeriod' }, ({ endsAt }) => ({
      label: t('receipt.rows.rewardPeriod'),
      value: t('receipt.rows.until', { date: formatDate(endsAt) }),
      tone: 'default',
    }))
    .with({ type: 'bankedReward' }, ({ days, endsAt }) => ({
      label: t('receipt.rows.bankedReward'),
      value:
        endsAt == null
          ? t('receipt.rows.days', { count: days })
          : t('receipt.rows.daysUntil', { count: days, date: formatDate(endsAt) }),
      tone: 'default',
    }))
    .with({ type: 'overallPeriod' }, ({ endsAt }) => ({
      label: t('receipt.rows.overallPeriod'),
      value: t('receipt.rows.until', { date: formatDate(endsAt) }),
      tone: 'default',
    }))
    .with({ type: 'daysLeft' }, ({ days, endingNotice }) => ({
      label: t('receipt.rows.daysLeft'),
      value: match(endingNotice)
        .with('today', () => t('endingNotice.badgeToday'))
        .with('tomorrow', () => t('endingNotice.badgeTomorrow'))
        .with(null, () => t('receipt.rows.days', { count: days }))
        .exhaustive(),
      tone: endingNotice == null ? 'default' : 'brand',
    }))
    .exhaustive();

  return (
    <ListRow
      verticalPadding="small"
      contents={
        <Text size="b4" shade={6}>
          {label}
        </Text>
      }
      right={
        <Text
          size="b4"
          weight="semibold"
          tone={tone === 'brand' ? 'brand' : 'neutral'}
          shade={tone === 'muted' ? 6 : 8}
          className="tabular-nums"
        >
          {value}
        </Text>
      }
    />
  );
}

/** 자동 갱신도 이어서 받을 보상도 없는 프리미엄이 하루 안에 끝나면 구독으로 이어 가도록 알린다 */
function PremiumEndingNotice() {
  const { t } = useTranslation('subscription');
  const { endingNotice } = useSubscriptionReceipt();

  if (endingNotice == null) {
    return null;
  }

  return (
    <>
      <HStack
        gap={10}
        align="center"
        accessibilityRole="summary"
        className="rounded-2xl bg-main/10 px-3.5 py-3"
      >
        <Box className="rounded-full bg-main px-2 py-0.5">
          <Text size="e1" weight="bold" className="text-white tabular-nums dark:text-gray-1">
            {endingNotice === 'today'
              ? t('endingNotice.badgeToday')
              : t('endingNotice.badgeTomorrow')}
          </Text>
        </Box>
        <Text size="b4" weight="semibold" tone="brand" className="flex-1">
          {endingNotice === 'today' ? t('endingNotice.today') : t('endingNotice.tomorrow')}
        </Text>
      </HStack>
      <Spacing size={12} />
    </>
  );
}

function ReceiptBenefitRow({ title }: { title: string }) {
  return (
    <ListRow
      verticalPadding="small"
      left={
        <Box className="bg-main w-5 h-5 rounded-full items-center justify-center">
          <FillCheckIcon width={12} height={12} colorClassName="text-white dark:text-gray-1" />
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

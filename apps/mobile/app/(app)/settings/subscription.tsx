import benefitAiParsingImage from '@assets/images/subscription/benefit-ai-parsing.webp';
import benefitAppIconImage from '@assets/images/subscription/benefit-app-icon.webp';
import benefitNotificationImage from '@assets/images/subscription/benefit-notification.webp';
import benefitNudgeImage from '@assets/images/subscription/benefit-nudge.webp';
import { useRevenueCatSdkManager } from '@src/bootstrap/providers/di-provider';
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
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import {
  BellIcon,
  CalendarIcon,
  CheckmarkIcon,
  DeviceIcon,
  DocsIcon,
  FillCheckIcon,
  ListIcon,
  PersonIcon,
  SendIcon,
} from '@src/shared/ui/Icon';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { Result } from '@src/shared/ui/Result/Result';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { TextButton } from '@src/shared/ui/TextButton/TextButton';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { formatFullDate } from '@src/shared/utils/date';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Card, Separator, Spinner } from 'heroui-native';
import { Suspense, useState } from 'react';
import { Image, Linking, ScrollView, View } from 'react-native';

/** 이미지가 있는 핵심 프리미엄 기능 */
const HIGHLIGHT_BENEFITS = [
  {
    icon: DocsIcon,
    title: 'AI 할일 파싱 무제한',
    description: '하루 5회 제한 없이, 자연어로 할 일을 마음껏 정리해요',
    image: benefitAiParsingImage,
  },
  {
    icon: SendIcon,
    title: '콕 찌르기 무제한',
    description: '하루 3회 제한 없이, 친구에게 마음껏 찔러요',
    image: benefitNudgeImage,
  },
  {
    icon: BellIcon,
    title: '리마인더 시간 자유 설정',
    description: '고정 시간 대신, 내가 원하는 시간에 알림을 받아요',
    image: benefitNotificationImage,
  },
  {
    icon: DeviceIcon,
    title: '앱 아이콘 커스터마이징',
    description: '나만의 스타일로 앱 아이콘을 바꿀 수 있어요',
    image: benefitAppIconImage,
  },
] as const;

/** 이미지 없는 추가 프리미엄 기능 */
const EXTRA_BENEFITS = [
  {
    icon: PersonIcon,
    title: '친구 무제한 추가',
    description: '5명 제한 없이, 친구를 자유롭게 추가해요',
  },
  {
    icon: ListIcon,
    title: '카테고리 최대 30개',
    description: '3개 제한에서 최대 30개까지 늘어나요',
  },
  {
    icon: CalendarIcon,
    title: 'AI 반복 제안',
    description: '반복되는 할 일을 AI가 자동으로 제안해요',
  },
  {
    icon: DocsIcon,
    title: 'AI 주간/월간 리포트',
    description: '내 할 일 달성률과 패턴을 한눈에 확인해요',
  },
] as const;

/** 구독자 체크리스트용 전체 혜택 제목 */
const ALL_BENEFIT_TITLES = [
  ...HIGHLIGHT_BENEFITS.map((b) => b.title),
  ...EXTRA_BENEFITS.map((b) => b.title),
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

      <View className="bg-main/10 rounded-2xl px-5 py-4">
        <HStack gap={12} className="items-center">
          <View className="bg-main w-10 h-10 rounded-full items-center justify-center">
            <CheckmarkIcon width={20} height={20} colorClassName="text-white" />
          </View>

          <VStack gap={2}>
            <Text size="t3" weight="bold" tone="brand">
              프리미엄 이용 중
            </Text>

            <Text size="b4" shade={6}>
              모든 프리미엄 기능을 이용하고 있어요
            </Text>
          </VStack>
        </HStack>

        {showDetails && (
          <>
            <Separator className="bg-main/20 my-4" />
            <VStack gap={8}>
              <HStack className="items-center justify-between">
                <Text size="b4" shade={5}>
                  {isActive ? '다음 결제일' : '만료일'}
                </Text>

                <Text size="b4" weight="semibold" shade={8}>
                  {user.subscriptionExpiresAt && formatFullDate(user.subscriptionExpiresAt)}
                </Text>
              </HStack>

              {isActive && (
                <HStack className="items-center justify-between">
                  <Text size="b4" shade={5}>
                    구독 상태
                  </Text>

                  <Text size="b4" weight="semibold" tone="brand">
                    자동 갱신
                  </Text>
                </HStack>
              )}
            </VStack>
          </>
        )}
      </View>

      <Spacing size={16} />

      <ActiveBenefitList />

      <Spacing size={16} />

      <Button onPress={handleManageSubscription} variant="weak" color="dark">
        구독 관리 (스토어 설정)
      </Button>

      <Spacing size={16} />

      <View className="items-center">
        <TextButton
          size="medium"
          variant="underline"
          onPress={() => restore.mutate()}
          isDisabled={restore.isPending}
        >
          이전 구매 복원
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
  return (
    <Result
      icon={<DocsIcon width={72} height={72} />}
      title="구독을 준비 중이에요"
      description="현재 구독 서비스를 이용할 수 없어요. 잠시 후 다시 시도해주세요."
    />
  );
}

function OfferingsView() {
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
        <Spacing size={24} />

        <VStack gap={4} className="items-center">
          <Text size="t1" weight="bold" shade={9}>
            프리미엄으로 업그레이드
          </Text>

          <Text size="b4" shade={6}>
            모든 기능을 제한 없이 사용해보세요
          </Text>
        </VStack>

        <Spacing size={24} />

        <VStack gap={12}>
          {HIGHLIGHT_BENEFITS.map((benefit) => (
            <BenefitCard key={benefit.title} benefit={benefit} />
          ))}
        </VStack>

        <Spacing size={12} />

        <ExtraBenefitCard />

        <Spacing size={8} />

        <Text size="e2" shade={5} align="center">
          향후 출시되는 모든 프리미엄 기능도 포함돼요
        </Text>

        <Spacing size={24} />

        <SubscriptionPlanCard
          plans={offering.plans}
          selectedPlanId={selectedPlanId}
          onPlanSelect={setSelectedPlanId}
        />

        <Spacing size={24} />

        <Separator className="bg-gray-2" />

        <Spacing size={16} />

        <VStack gap={8} className="items-center">
          <TermsNotice />
          <TextButton
            size="small"
            variant="underline"
            onPress={() => restore.mutate()}
            isDisabled={restore.isPending}
          >
            이전 구매 복원
          </TextButton>
        </VStack>
      </ScrollView>

      <View className="px-4 pb-4 pt-2">
        <Button
          onPress={handlePurchase}
          isLoading={purchase.isPending}
          isDisabled={!selectedPlan || purchase.isPending}
        >
          구독하기
        </Button>
      </View>
    </View>
  );
}

function BenefitCard({ benefit }: { benefit: (typeof HIGHLIGHT_BENEFITS)[number] }) {
  const Icon = benefit.icon;

  return (
    <Card className="dark:bg-gray-2">
      <VStack gap={12}>
        <HStack gap={12} className="items-center">
          <View className="bg-main/10 w-10 h-10 rounded-xl items-center justify-center">
            <Icon width={20} height={20} colorClassName="text-main" />
          </View>

          <VStack gap={2} className="flex-1">
            <Text size="b3" weight="bold" shade={9}>
              {benefit.title}
            </Text>

            <Text size="b4" shade={6}>
              {benefit.description}
            </Text>
          </VStack>
        </HStack>
        <View className="w-full aspect-video rounded-xl overflow-hidden">
          <Image source={benefit.image} className="size-full" resizeMode="cover" />
        </View>
      </VStack>
    </Card>
  );
}

function ExtraBenefitCard() {
  return (
    <Card className="dark:bg-gray-2">
      <VStack gap={16}>
        <Text size="b3" weight="semibold" shade={9}>
          더 많은 프리미엄 혜택
        </Text>

        {EXTRA_BENEFITS.map((benefit, index) => {
          const Icon = benefit.icon;

          return (
            <View key={benefit.title}>
              {index > 0 && <Separator className="bg-gray-2 dark:bg-gray-3 mb-4" />}
              <HStack gap={12} className="items-center">
                <View className="bg-main/10 w-10 h-10 rounded-xl items-center justify-center">
                  <Icon width={20} height={20} colorClassName="text-main" />
                </View>

                <VStack gap={2} className="flex-1">
                  <Text size="b3" weight="bold" shade={9}>
                    {benefit.title}
                  </Text>

                  <Text size="b4" shade={6}>
                    {benefit.description}
                  </Text>
                </VStack>
              </HStack>
            </View>
          );
        })}
      </VStack>
    </Card>
  );
}

function ActiveBenefitList() {
  return (
    <Card className="dark:bg-gray-2">
      <VStack gap={14}>
        <Text size="b3" weight="semibold" shade={9}>
          이용 중인 혜택
        </Text>

        <VStack gap={12}>
          {ALL_BENEFIT_TITLES.map((title) => (
            <HStack key={title} gap={10} className="items-center">
              <View className="bg-main w-5 h-5 rounded-full items-center justify-center">
                <FillCheckIcon width={12} height={12} colorClassName="text-white" />
              </View>

              <Text size="b4" shade={8}>
                {title}
              </Text>
            </HStack>
          ))}
          <HStack gap={10} className="items-center">
            <View className="bg-main w-5 h-5 rounded-full items-center justify-center">
              <FillCheckIcon width={12} height={12} colorClassName="text-white" />
            </View>

            <Text size="b4" shade={8}>
              향후 출시되는 모든 프리미엄 기능
            </Text>
          </HStack>
        </VStack>
      </VStack>
    </Card>
  );
}

function TermsNotice() {
  const openUrl = useOpenUrl();

  return (
    <Text size="e2" shade={4} align="center">
      구매 시{' '}
      <Text size="e2" shade={5} underline onPress={() => openUrl(LEGAL_URLS.TERMS)}>
        이용약관
      </Text>
      {' 및 '}
      <Text size="e2" shade={5} underline onPress={() => openUrl(LEGAL_URLS.PRIVACY)}>
        개인정보처리방침
      </Text>
      에 동의하게 됩니다.
    </Text>
  );
}

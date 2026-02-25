import { useRevenueCatSdkManager } from '@src/bootstrap/providers/di-provider';
import { SubscriptionPlanCard } from '@src/features/subscription/presentations/components/SubscriptionPlanCard';
import { SubscriptionStatusCard } from '@src/features/subscription/presentations/components/SubscriptionStatusCard';
import { getOfferingsQueryOptions } from '@src/features/subscription/presentations/queries/get-offerings-query-options';
import { purchaseMutationOptions } from '@src/features/subscription/presentations/queries/purchase-mutation-options';
import { restoreMutationOptions } from '@src/features/subscription/presentations/queries/restore-mutation-options';
import { UserPolicy } from '@src/features/user/models/user.model';
import { getMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { LEGAL_URLS } from '@src/shared/constants/legal-urls.constant';
import { useOpenUrl } from '@src/shared/hooks/useOpenUrl';
import { Button } from '@src/shared/ui/Button/Button';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { BellIcon, DeviceIcon, DocsIcon, SendIcon, type StyledIconType } from '@src/shared/ui/Icon';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { TextButton } from '@src/shared/ui/TextButton/TextButton';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense, useState } from 'react';
import { ActivityIndicator, Linking, Platform, ScrollView, View } from 'react-native';

// App Store / Play Store 구독 관리 URL
const STORE_SUBSCRIPTION_URL = Platform.select({
  ios: 'https://apps.apple.com/account/subscriptions',
  android: 'https://play.google.com/store/account/subscriptions',
  default: '',
});

interface PremiumBenefit {
  icon: StyledIconType;
  iconColor: string;
  iconBg: string;
  title: string;
  description: string;
  /** 추후 이미지 추가 시 사용할 키 */
  imageKey: string;
}

const PREMIUM_BENEFITS: PremiumBenefit[] = [
  {
    icon: DocsIcon,
    iconColor: 'text-main',
    iconBg: 'bg-main/10',
    title: '무제한 할 일 AI 파싱',
    description: '자연어로 입력하면 AI가 자동으로 할 일을 정리해요',
    imageKey: 'ai-parsing',
  },
  {
    icon: BellIcon,
    iconColor: 'text-main',
    iconBg: 'bg-main/10',
    title: '고급 알림 설정',
    description: '원하는 시간에 맞춤 알림을 받을 수 있어요',
    imageKey: 'advanced-notifications',
  },
  {
    icon: DeviceIcon,
    iconColor: 'text-main',
    iconBg: 'bg-main/10',
    title: '앱 아이콘 커스터마이징',
    description: '나만의 스타일로 앱 아이콘을 변경해요',
    imageKey: 'app-icon-customization',
  },
  {
    icon: SendIcon,
    iconColor: 'text-main',
    iconBg: 'bg-main/10',
    title: '무제한 찌르기 & 응원',
    description: '친구에게 제한 없이 찌르기와 응원을 보내요',
    imageKey: 'unlimited-poke',
  },
];

const SubscriptionScreen = () => {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <QueryErrorBoundary>
        <Suspense
          fallback={
            <View className="flex-1 items-center justify-center">
              <ActivityIndicator size="large" />
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
  const { data: user } = useSuspenseQuery(getMeQueryOptions());
  const isPremium = UserPolicy.isPremiumUser(user);

  if (isPremium) {
    return <SubscriberView />;
  }

  return <NonSubscriberView />;
}

function SubscriberView() {
  const { data: user } = useSuspenseQuery(getMeQueryOptions());
  const restore = useMutation(restoreMutationOptions());

  const handleManageSubscription = () => {
    if (STORE_SUBSCRIPTION_URL) {
      Linking.openURL(STORE_SUBSCRIPTION_URL);
    }
  };

  return (
    <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
      <Spacing size={16} />

      <SubscriptionStatusCard
        subscriptionStatus={user.subscriptionStatus}
        subscriptionExpiresAt={user.subscriptionExpiresAt}
      />

      <Spacing size={16} />

      <PremiumBenefitsCard />

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
    <View className="flex-1 items-center justify-center px-8">
      <VStack gap={8} className="items-center">
        <Text size="t3" weight="bold" className="text-gray-9">
          구독을 준비 중이에요
        </Text>
        <Text size="b4" className="text-gray-6 text-center">
          현재 구독 서비스를 이용할 수 없어요. 잠시 후 다시 시도해주세요.
        </Text>
      </VStack>
    </View>
  );
}

function OfferingsView() {
  const { data: offering } = useSuspenseQuery(getOfferingsQueryOptions());
  const purchase = useMutation(purchaseMutationOptions());
  const restore = useMutation(restoreMutationOptions());

  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(
    () =>
      offering.plans.find((p) => p.planType === 'annual')?.identifier ??
      offering.plans[0]?.identifier ??
      null,
  );

  const selectedPlan = offering.plans.find((p) => p.identifier === selectedPlanId);

  const handlePurchase = () => {
    if (!selectedPlan) return;
    purchase.mutate(selectedPlan.identifier);
  };

  return (
    <View className="flex-1">
      <ScrollView className="flex-1 px-4" contentContainerClassName="pb-8">
        <Spacing size={24} />

        <VStack gap={4} className="items-center">
          <Text size="t1" weight="bold" className="text-gray-9">
            프리미엄으로 업그레이드
          </Text>
          <Text size="b4" className="text-gray-6">
            모든 기능을 제한 없이 사용해보세요
          </Text>
        </VStack>

        <Spacing size={24} />

        <PremiumBenefitsCard />

        <Spacing size={24} />

        <SubscriptionPlanCard
          plans={offering.plans}
          selectedPlanId={selectedPlanId}
          onPlanSelect={setSelectedPlanId}
        />
      </ScrollView>

      {/* 하단 고정 영역 */}
      <VStack gap={12} className="px-4 pb-4 pt-2">
        <Button
          onPress={handlePurchase}
          isLoading={purchase.isPending}
          isDisabled={!selectedPlan || purchase.isPending}
        >
          구독하기
        </Button>
        <VStack gap={8} className="items-center">
          <Text size="e1" className="text-gray-5">
            언제든지 취소할 수 있어요
          </Text>
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
      </VStack>
    </View>
  );
}

function PremiumBenefitsCard() {
  return (
    <VStack gap={12}>
      {PREMIUM_BENEFITS.map((benefit, index) => (
        <BenefitCard key={benefit.imageKey} benefit={benefit} index={index} />
      ))}
    </VStack>
  );
}

function BenefitCard({ benefit, index }: { benefit: PremiumBenefit; index: number }) {
  const IconComponent = benefit.icon;

  return (
    <VStack gap={12} className="bg-white rounded-2xl p-4">
      {/* 뱃지 */}
      <View className="self-start bg-main/10 px-2.5 py-1 rounded-full">
        <Text size="e2" weight="bold" className="text-main">
          혜택 {index + 1}
        </Text>
      </View>

      {/* 아이콘 + 텍스트 */}
      <HStack gap={12} className="items-center">
        <View className={`${benefit.iconBg} w-10 h-10 rounded-xl items-center justify-center`}>
          <IconComponent width={20} height={20} colorClassName={benefit.iconColor} />
        </View>
        <VStack gap={2} className="flex-1">
          <Text size="b3" weight="bold" className="text-gray-9">
            {benefit.title}
          </Text>
          <Text size="b4" className="text-gray-6">
            {benefit.description}
          </Text>
        </VStack>
      </HStack>

      {/* 이미지 플레이스홀더 — 추후 실제 이미지로 교체 */}
      <View className="w-full h-44 bg-gray-1 rounded-xl items-center justify-center">
        <Text size="e1" className="text-gray-4">
          미리보기 이미지
        </Text>
      </View>
    </VStack>
  );
}

function TermsNotice() {
  const openUrl = useOpenUrl();

  return (
    <Text size="e2" className="text-gray-4 text-center">
      구매 시{' '}
      <Text size="e2" className="text-gray-5" underline onPress={() => openUrl(LEGAL_URLS.TERMS)}>
        이용약관
      </Text>
      {' 및 '}
      <Text size="e2" className="text-gray-5" underline onPress={() => openUrl(LEGAL_URLS.PRIVACY)}>
        개인정보처리방침
      </Text>
      에 동의하게 됩니다.
    </Text>
  );
}

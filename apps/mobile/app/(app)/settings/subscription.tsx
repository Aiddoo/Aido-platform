import benefitAiParsingImage from '@assets/images/subscription/benefit-ai-parsing.webp';
import benefitAppIconImage from '@assets/images/subscription/benefit-app-icon.webp';
import benefitNotificationImage from '@assets/images/subscription/benefit-notification.webp';
import benefitNudgeImage from '@assets/images/subscription/benefit-nudge.webp';
import { useRevenueCatSdkManager } from '@src/bootstrap/providers/di-provider';
import { SubscriptionPlanCard } from '@src/features/subscription/presentations/components/SubscriptionPlanCard';
import { SubscriptionStatusCard } from '@src/features/subscription/presentations/components/SubscriptionStatusCard';
import { getOfferingsQueryOptions } from '@src/features/subscription/presentations/queries/get-offerings-query-options';
import { purchaseMutationOptions } from '@src/features/subscription/presentations/queries/purchase-mutation-options';
import { restoreMutationOptions } from '@src/features/subscription/presentations/queries/restore-mutation-options';
import { UserPolicy } from '@src/features/user/models/user.model';
import { getMeQueryOptions } from '@src/features/user/presentations/queries/get-me-query-options';
import { LEGAL_URLS } from '@src/shared/constants/legal-urls.constant';
import { STORE_URLS } from '@src/shared/constants/store-urls.constant';
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
import { Card, Chip, Separator, Spinner } from 'heroui-native';
import { Suspense, useState } from 'react';
import { Image, type ImageSourcePropType, Linking, ScrollView, View } from 'react-native';

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
    if (STORE_URLS.SUBSCRIPTION_MANAGEMENT) {
      Linking.openURL(STORE_URLS.SUBSCRIPTION_MANAGEMENT);
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

      <VStack gap={12}>
        <BenefitCard
          icon={DocsIcon}
          title="무제한 할 일 AI 파싱"
          description="자연어로 입력하면 AI가 자동으로 할 일을 정리해요"
          index={0}
          image={benefitAiParsingImage}
        />
        <BenefitCard
          icon={BellIcon}
          title="고급 알림 설정"
          description="원하는 시간에 맞춤 알림을 받을 수 있어요"
          index={1}
          image={benefitNotificationImage}
        />
        <BenefitCard
          icon={SendIcon}
          title="무제한 찌르기 & 응원"
          description="친구에게 제한 없이 찌르기와 응원을 보내요"
          index={2}
          image={benefitNudgeImage}
        />
        <BenefitCard
          icon={DeviceIcon}
          title="앱 아이콘 커스터마이징"
          description="나만의 스타일로 앱 아이콘을 변경해요"
          index={3}
          image={benefitAppIconImage}
        />
      </VStack>

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
        <Text size="t3" weight="bold" shade={9}>
          구독을 준비 중이에요
        </Text>
        <Text size="b4" shade={6} align="center">
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

        <SubscriptionPlanCard
          plans={offering.plans}
          selectedPlanId={selectedPlanId}
          onPlanSelect={setSelectedPlanId}
        />

        <Spacing size={24} />

        <VStack gap={12}>
          <BenefitCard
            icon={DocsIcon}
            title="무제한 할 일 AI 파싱"
            description="자연어로 입력하면 AI가 자동으로 할 일을 정리해요"
            index={0}
            image={benefitAiParsingImage}
          />
          <BenefitCard
            icon={BellIcon}
            title="고급 알림 설정"
            description="원하는 시간에 맞춤 알림을 받을 수 있어요"
            index={1}
            image={benefitNotificationImage}
          />
          <BenefitCard
            icon={SendIcon}
            title="무제한 찌르기 & 응원"
            description="친구에게 제한 없이 찌르기와 응원을 보내요"
            index={2}
            image={benefitNudgeImage}
          />
          <BenefitCard
            icon={DeviceIcon}
            title="앱 아이콘 커스터마이징"
            description="나만의 스타일로 앱 아이콘을 변경해요"
            index={3}
            image={benefitAppIconImage}
          />
        </VStack>

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

function BenefitCard({
  icon: Icon,
  title,
  description,
  index,
  image,
}: {
  icon: StyledIconType;
  title: string;
  description: string;
  index: number;
  image: ImageSourcePropType;
}) {
  return (
    <Card className="dark:bg-gray-2">
      <VStack gap={12}>
        <Chip size="sm" variant="soft" color="accent" className="self-start">
          <Chip.Label>혜택 {index + 1}</Chip.Label>
        </Chip>
        <HStack gap={12} className="items-center">
          <View className="bg-main/10 w-10 h-10 rounded-xl items-center justify-center">
            <Icon width={20} height={20} colorClassName="text-main" />
          </View>
          <VStack gap={2} className="flex-1">
            <Text size="b3" weight="bold" shade={9}>
              {title}
            </Text>
            <Text size="b4" shade={6}>
              {description}
            </Text>
          </VStack>
        </HStack>
        <View className="w-full aspect-video rounded-xl overflow-hidden">
          <Image source={image} className="w-full h-full" resizeMode="cover" />
        </View>
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

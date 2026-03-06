import { useGetConsentQueryOptions } from '@src/features/auth/presentations/queries/use-get-consent-query-options';
import { useUpdateMarketingConsentMutationOptions } from '@src/features/auth/presentations/queries/use-update-marketing-consent-mutation-options';
import { LEGAL_URLS } from '@src/shared/constants/legal-urls.constant';
import { useOpenUrl } from '@src/shared/hooks/useOpenUrl';
import {
  ArrowRightIcon,
  HStack,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import {
  ControlField,
  Description,
  Label,
  PressableFeedback,
  Separator,
  Skeleton,
  SkeletonGroup,
} from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView, View } from 'react-native';

const TermsSettingsScreen = () => {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <Spacing size={20} />
        <QueryErrorBoundary>
          <Suspense fallback={<TermsSettingsForm.Loading />}>
            <TermsSettingsForm />
          </Suspense>
        </QueryErrorBoundary>
      </ScrollView>
    </StyledSafeAreaView>
  );
};

export default TermsSettingsScreen;

function TermsSettingsForm() {
  const { data: consent } = useSuspenseQuery(useGetConsentQueryOptions());
  const updateMutation = useMutation(useUpdateMarketingConsentMutationOptions());
  const openUrl = useOpenUrl();

  const formatDate = (date: Date | null) => {
    if (!date) return '미동의';
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const marketingAgreed = consent.marketingAgreedAt !== null;

  return (
    <>
      <VStack p={16} gap={8} className="bg-white rounded-2xl">
        <PressableFeedback hitSlop={8} onPress={() => openUrl(LEGAL_URLS.TERMS)}>
          <HStack justify="between" align="center">
            <VStack gap={4}>
              <Text size="b2" weight="medium">
                서비스 이용약관
              </Text>

              <VStack gap={2}>
                <Text size="b4" shade={6}>
                  동의일: {formatDate(consent.termsAgreedAt)}
                </Text>

                {consent.agreedTermsVersion && (
                  <Text size="b4" shade={6}>
                    버전: {consent.agreedTermsVersion}
                  </Text>
                )}
              </VStack>
            </VStack>
            <ArrowRightIcon width={16} height={16} colorClassName="text-gray-5" />
          </HStack>
        </PressableFeedback>

        <Separator className="bg-gray-2" />

        <PressableFeedback hitSlop={8} onPress={() => openUrl(LEGAL_URLS.PRIVACY)}>
          <HStack justify="between" align="center">
            <VStack gap={4}>
              <Text size="b2" weight="medium">
                개인정보처리방침
              </Text>

              <VStack gap={2}>
                <Text size="b4" shade={6}>
                  동의일: {formatDate(consent.privacyAgreedAt)}
                </Text>

                {consent.agreedTermsVersion && (
                  <Text size="b4" shade={6}>
                    버전: {consent.agreedTermsVersion}
                  </Text>
                )}
              </VStack>
            </VStack>
            <ArrowRightIcon width={16} height={16} colorClassName="text-gray-5" />
          </HStack>
        </PressableFeedback>
      </VStack>

      <Spacing size={12} />

      <VStack p={16} className="bg-white rounded-2xl">
        <ControlField
          isSelected={marketingAgreed}
          onSelectedChange={(agreed) => updateMutation.mutate({ agreed })}
          isDisabled={updateMutation.isPending}
        >
          <View className="flex-1">
            <Label>마케팅 수신 동의</Label>
            <Description>이벤트 및 프로모션 정보를 받습니다</Description>
          </View>
          <ControlField.Indicator />
        </ControlField>
      </VStack>
    </>
  );
}

TermsSettingsForm.Loading = function Loading() {
  return (
    <>
      <VStack p={16} gap={8} className="bg-white rounded-2xl">
        <SkeletonGroup isLoading isSkeletonOnly>
          <VStack gap={4} className="py-2">
            <Skeleton className="h-5 w-28 rounded" />
            <VStack gap={2}>
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </VStack>
          </VStack>

          <Separator className="bg-gray-2" />

          <VStack gap={4} className="py-2">
            <Skeleton className="h-5 w-32 rounded" />
            <VStack gap={2}>
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </VStack>
          </VStack>
        </SkeletonGroup>
      </VStack>

      <Spacing size={12} />

      <VStack p={16} className="bg-white rounded-2xl">
        <SkeletonGroup isLoading isSkeletonOnly>
          <HStack justify="between" align="center" className="py-2">
            <VStack flex={1} gap={2}>
              <Skeleton className="h-5 w-32 rounded" />
              <Skeleton className="h-4 w-48 rounded" />
            </VStack>
            <Skeleton className="h-8 w-14 rounded-full" />
          </HStack>
        </SkeletonGroup>
      </VStack>
    </>
  );
};

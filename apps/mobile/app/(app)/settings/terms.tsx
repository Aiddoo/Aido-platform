import { getConsentQueryOptions } from '@src/features/auth/presentations/queries/get-consent-query-options';
import { updateMarketingConsentMutationOptions } from '@src/features/auth/presentations/queries/update-marketing-consent-mutation-options';
import { HStack } from '@src/shared/ui/HStack/HStack';
import { QueryErrorBoundary } from '@src/shared/ui/QueryErrorBoundary/QueryErrorBoundary';
import { StyledSafeAreaView } from '@src/shared/ui/SafeAreaView/SafeAreaView';
import { Spacing } from '@src/shared/ui/Spacing/Spacing';
import { Text } from '@src/shared/ui/Text/Text';
import { VStack } from '@src/shared/ui/VStack/VStack';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Divider, FormField, Skeleton, SkeletonGroup } from 'heroui-native';
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
  const { data: consent } = useSuspenseQuery(getConsentQueryOptions());
  const updateMutation = useMutation(updateMarketingConsentMutationOptions());

  const formatDate = (dateString: string | null) => {
    if (!dateString) return '미동의';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const marketingAgreed = consent.marketingAgreedAt !== null;

  return (
    <>
      <VStack p={8} gap={8} className="bg-white rounded-2xl">
        <VStack gap={4} className="py-2">
          <Text size="b4" weight="medium">
            서비스 이용약관
          </Text>
          <VStack gap={2}>
            <Text size="e1" shade={6}>
              동의일: {formatDate(consent.termsAgreedAt)}
            </Text>
            {consent.agreedTermsVersion && (
              <Text size="e1" shade={6}>
                버전: {consent.agreedTermsVersion}
              </Text>
            )}
          </VStack>
        </VStack>

        <Divider className="bg-gray-2" />

        <VStack gap={4} className="py-2">
          <Text size="b4" weight="medium">
            개인정보처리방침
          </Text>
          <VStack gap={2}>
            <Text size="e1" shade={6}>
              동의일: {formatDate(consent.privacyAgreedAt)}
            </Text>
            {consent.agreedTermsVersion && (
              <Text size="e1" shade={6}>
                버전: {consent.agreedTermsVersion}
              </Text>
            )}
          </VStack>
        </VStack>
      </VStack>

      <Spacing size={12} />

      <VStack p={8} className="bg-white rounded-2xl">
        <FormField
          isSelected={marketingAgreed}
          onSelectedChange={(agreed) => updateMutation.mutate({ agreed })}
          isDisabled={updateMutation.isPending}
          className="py-2"
        >
          <View className="flex-1">
            <FormField.Label>마케팅 수신 동의</FormField.Label>
            <FormField.Description>이벤트 및 프로모션 정보를 받습니다</FormField.Description>
          </View>
          <FormField.Indicator />
        </FormField>
      </VStack>
    </>
  );
}

TermsSettingsForm.Loading = function Loading() {
  return (
    <>
      <VStack p={8} gap={8} className="bg-white rounded-2xl">
        <SkeletonGroup isLoading isSkeletonOnly>
          <VStack gap={4} className="py-2">
            <Skeleton className="h-5 w-28 rounded" />
            <VStack gap={2}>
              <Skeleton className="h-4 w-40 rounded" />
              <Skeleton className="h-4 w-24 rounded" />
            </VStack>
          </VStack>

          <Divider className="bg-gray-2" />

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

      <VStack p={8} className="bg-white rounded-2xl">
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

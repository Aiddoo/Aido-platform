import { useGetConsentQueryOptions } from '@src/features/auth/presentations/queries/use-get-consent-query-options';
import { useUpdateMarketingConsentMutationOptions } from '@src/features/auth/presentations/queries/use-update-marketing-consent-mutation-options';
import { useUpdateMarketingPushConsentMutationOptions } from '@src/features/auth/presentations/queries/use-update-marketing-push-consent-mutation-options';
import { SettingsToggle } from '@src/features/notification/presentations/components/settings/SettingsToggle';
import { LEGAL_URLS } from '@src/shared/constants/legal-urls.constant';
import { useOpenUrl } from '@src/shared/hooks/useOpenUrl';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  HStack,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  Text,
  VStack,
} from '@src/shared/ui';
import { formatFullDate } from '@src/shared/utils/date';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { PressableFeedback, Separator, Skeleton, SkeletonGroup } from 'heroui-native';
import { Suspense } from 'react';
import { ScrollView } from 'react-native';

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
  const { t } = useTranslation('settings');
  const { data: consent } = useSuspenseQuery(useGetConsentQueryOptions());
  const updateMutation = useMutation(useUpdateMarketingConsentMutationOptions());
  const updatePushMutation = useMutation(useUpdateMarketingPushConsentMutationOptions());
  const openUrl = useOpenUrl();

  const formatDate = (date: Date | null) => {
    if (!date) {
      return t('terms.notAgreed');
    }
    return formatFullDate(date);
  };

  const marketingAgreed = consent.marketingAgreedAt !== null;
  const marketingPushAgreed = consent.marketingPushAgreedAt !== null;

  return (
    <>
      <VStack p={16} gap={8} className="bg-white rounded-2xl">
        <PressableFeedback hitSlop={8} onPress={() => openUrl(LEGAL_URLS.TERMS)}>
          <HStack justify="between" align="center">
            <VStack gap={4}>
              <Text size="b2" shade={8}>
                {t('terms.termsOfService')}
              </Text>

              <VStack gap={2}>
                <Text size="b3" shade={6}>
                  {t('terms.agreedAt', { date: formatDate(consent.termsAgreedAt) })}
                </Text>

                {consent.agreedTermsVersion && (
                  <Text size="b3" shade={6}>
                    {t('terms.version', { version: consent.agreedTermsVersion })}
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
              <Text size="b2" shade={8}>
                {t('terms.privacyPolicy')}
              </Text>

              <VStack gap={2}>
                <Text size="b3" shade={6}>
                  {t('terms.agreedAt', { date: formatDate(consent.privacyAgreedAt) })}
                </Text>

                {consent.agreedTermsVersion && (
                  <Text size="b3" shade={6}>
                    {t('terms.version', { version: consent.agreedTermsVersion })}
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
        <SettingsToggle
          label={t('terms.marketing')}
          description={t('terms.marketingDescription')}
          isSelected={marketingAgreed}
          onSelectedChange={(agreed) => updateMutation.mutate({ agreed })}
          isDisabled={updateMutation.isPending}
        />
      </VStack>

      <Spacing size={12} />

      <VStack p={16} className="bg-white rounded-2xl">
        <SettingsToggle
          label={t('terms.marketingPush')}
          description={t('terms.marketingPushDescription')}
          isSelected={marketingPushAgreed}
          onSelectedChange={(agreed) => updatePushMutation.mutate({ agreed })}
          isDisabled={updatePushMutation.isPending}
        />
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

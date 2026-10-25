import { ConsentPolicy } from '@src/features/auth/domains/auth.model';
import { useGetConsentQueryOptions } from '@src/features/auth/queries/get-consent-query-options';
import { useUpdateAiDataSharingConsentMutationOptions } from '@src/features/auth/queries/use-update-ai-data-sharing-consent-mutation-options';
import { SettingsCard } from '@src/features/notification/components/settings/settings-card';
import { ToggleSkeleton } from '@src/features/notification/components/settings/settings-skeleton';
import { SettingsToggle } from '@src/features/notification/components/settings/settings-toggle';
import { LEGAL_URLS } from '@src/shared/constants/legal-urls';
import { useOpenUrl } from '@src/shared/hooks/use-open-url';
import { useTranslation } from '@src/shared/i18n';
import {
  ArrowRightIcon,
  HStack,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  Text,
  TextSkeleton,
  useConfirmDialog,
  VStack,
} from '@src/shared/ui';
import { formatFullDate, getDateFormatContext } from '@src/shared/utils/date';
import { formatDateLabel } from '@src/shared/utils/date-format';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { times } from 'es-toolkit/compat';
import { PressableFeedback, Separator } from 'heroui-native';
import { Fragment, Suspense } from 'react';
import { ScrollView } from 'react-native';

function TermsSettingsScreen() {
  const { t } = useTranslation('settings');
  const { data: consent } = useSuspenseQuery(useGetConsentQueryOptions());
  const openUrl = useOpenUrl();

  const formatDate = (date: Date | null) => {
    if (!date) {
      return t('terms.notAgreed');
    }
    return formatFullDate(date);
  };

  return (
    <VStack gap={24}>
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

      <AiDataSharingConsentCard />
    </VStack>
  );
}

TermsSettingsScreen.Loading = function Loading() {
  return (
    <VStack gap={24}>
      <VStack p={16} gap={8} className="bg-white rounded-2xl">
        {times(2, (index) => (
          <Fragment key={index}>
            {index > 0 && <Separator className="bg-gray-2" />}
            <HStack justify="between" align="center">
              <VStack gap={4}>
                <TextSkeleton size="b2" className="w-28" />
                <VStack gap={2}>
                  <TextSkeleton size="b3" className="w-40" />
                  <TextSkeleton size="b3" className="w-24" />
                </VStack>
              </VStack>
              <ArrowRightIcon width={16} height={16} colorClassName="text-gray-3" />
            </HStack>
          </Fragment>
        ))}
      </VStack>

      <SettingsCard>
        <ToggleSkeleton hasDescription />
      </SettingsCard>
    </VStack>
  );
};

export default function TermsSettingsRoute() {
  return (
    <StyledSafeAreaView className="flex-1 bg-gray-1" edges={['bottom']}>
      <ScrollView className="px-4 flex-1">
        <StyledSafeAreaView edges={['left', 'right']}>
          <Spacing size={20} />
          <QueryErrorBoundary>
            <Suspense fallback={<TermsSettingsScreen.Loading />}>
              <TermsSettingsScreen />
            </Suspense>
          </QueryErrorBoundary>
        </StyledSafeAreaView>
      </ScrollView>
    </StyledSafeAreaView>
  );
}

/**
 * AI 기능 데이터 제공 동의. 끌 때는 AI 기능이 꺼진다는 결과를 확인받고, 켤 때는 바로 저장한다.
 * 동의일은 지금 안내 버전에 동의했을 때만 보인다.
 */
function AiDataSharingConsentCard() {
  const { t } = useTranslation(['settings', 'common']);
  const { data: consent } = useSuspenseQuery(useGetConsentQueryOptions());
  const updateConsent = useMutation(useUpdateAiDataSharingConsentMutationOptions());
  const confirmDialog = useConfirmDialog();
  const isAgreed = ConsentPolicy.hasAgreedToAiDataSharing(consent);

  const handleSelectedChange = async (agreed: boolean) => {
    if (!agreed) {
      const isConfirmed = await confirmDialog.open({
        title: t('settings:terms.aiDataSharing.withdrawTitle'),
        description: t('settings:terms.aiDataSharing.withdrawDescription'),
        confirmLabel: t('settings:terms.aiDataSharing.withdrawConfirm'),
        confirmColor: 'danger',
        cancelLabel: t('common:actions.cancel'),
      });
      if (!isConfirmed) {
        return;
      }
    }
    updateConsent.mutate({ agreed });
  };

  return (
    <SettingsCard>
      <SettingsToggle
        label={t('settings:terms.aiDataSharing.label')}
        description={t('settings:terms.aiDataSharing.description')}
        isSelected={isAgreed}
        onSelectedChange={handleSelectedChange}
        isDisabled={updateConsent.isPending}
      />
      {isAgreed && consent.aiDataSharingAgreedAt != null && (
        <Text size="e1" shade={6}>
          {t('settings:terms.aiDataSharing.agreedOn', {
            date: formatDateLabel(
              consent.aiDataSharingAgreedAt,
              'numericDate',
              getDateFormatContext(),
            ),
          })}
        </Text>
      )}
    </SettingsCard>
  );
}

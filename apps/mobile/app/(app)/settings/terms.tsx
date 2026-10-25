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
  TextButton,
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
import { match, P } from 'ts-pattern';

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
 * AI 기능 데이터 제공 동의. 켜면 동의, 끄면 결과를 확인받고 철회한다.
 * 아직 답하지 않은 사용자는 꺼진 채로 두고, 묻기 전에 미리 "사용 안 함"을 고를 수 있다.
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
      {match(consent)
        .with(
          { aiDataSharingDecision: 'AGREED', aiDataSharingAgreedAt: P.nonNullable },
          ({ aiDataSharingAgreedAt }) => (
            <Text size="e1" shade={6}>
              {t('settings:terms.aiDataSharing.agreedOn', {
                date: formatDateLabel(aiDataSharingAgreedAt, 'numericDate', getDateFormatContext()),
              })}
            </Text>
          ),
        )
        .with({ aiDataSharingDecision: 'AGREED' }, () => null)
        .with({ aiDataSharingDecision: 'DECLINED' }, () => (
          <Text size="e1" shade={6}>
            {t('settings:terms.aiDataSharing.declinedStatus')}
          </Text>
        ))
        .with({ aiDataSharingDecision: 'UNDECIDED' }, () => (
          <HStack gap={12} align="center">
            <Text size="e1" shade={6} className="flex-1">
              {t('settings:terms.aiDataSharing.undecidedStatus')}
            </Text>
            <TextButton
              size="small"
              variant="underline"
              isDisabled={updateConsent.isPending}
              onPress={() => updateConsent.mutate({ agreed: false })}
            >
              {t('settings:terms.aiDataSharing.decline')}
            </TextButton>
          </HStack>
        ))
        .exhaustive()}
    </SettingsCard>
  );
}

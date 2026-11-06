import { ConsentPolicy } from '@src/features/identity/auth/domains/auth.model';
import { useGetConsentQueryOptions } from '@src/features/identity/auth/queries/get-consent-query-options';
import { useUpdateAiDataSharingConsentMutationOptions } from '@src/features/identity/auth/queries/use-update-ai-data-sharing-consent-mutation-options';
import { legalUrl } from '@src/shared/constants/legal-urls';
import { formatDateLabel } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useOpenUrl } from '@src/shared/hooks/use-open-url';
import { useTranslation } from '@src/shared/i18n';
import { useLanguage } from '@src/shared/providers/language-provider';
import {
  HStack,
  QueryErrorBoundary,
  SettingsCard,
  SettingsScreenLayout,
  Text,
  TextButton,
  useConfirmDialog,
} from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import { Suspense } from 'react';
import { match, P } from 'ts-pattern';

function TermsSettingsScreen() {
  const { t } = useTranslation('settings');
  const { data: consent } = useSuspenseQuery(useGetConsentQueryOptions());
  const openUrl = useOpenUrl();
  const { resolvedLanguage } = useLanguage();
  const dateFormatContext = useDateFormatContext();

  const formatAgreedDate = (date: Date | null) => {
    if (date == null) {
      return t('terms.notAgreed');
    }
    return formatDateLabel(date, 'fullDate', dateFormatContext);
  };

  const getConsentDescription = (agreedAt: Date | null) =>
    [
      t('terms.agreedAt', { date: formatAgreedDate(agreedAt) }),
      ...(consent.agreedTermsVersion
        ? [t('terms.version', { version: consent.agreedTermsVersion })]
        : []),
    ].join('\n');

  return (
    <>
      <SettingsCard>
        <SettingsCard.Item
          label={t('terms.termsOfService')}
          description={getConsentDescription(consent.termsAgreedAt)}
          onPress={() => openUrl(legalUrl('terms', resolvedLanguage))}
        />
        <SettingsCard.Separator />
        <SettingsCard.Item
          label={t('terms.privacyPolicy')}
          description={getConsentDescription(consent.privacyAgreedAt)}
          onPress={() => openUrl(legalUrl('privacy', resolvedLanguage))}
        />
      </SettingsCard>

      <AiDataSharingConsentCard />
    </>
  );
}

TermsSettingsScreen.Loading = function Loading() {
  return (
    <>
      <SettingsCard>
        <SettingsCard.ItemSkeleton descriptionLines={2} />
        <SettingsCard.Separator />
        <SettingsCard.ItemSkeleton descriptionLines={2} />
      </SettingsCard>

      <SettingsCard>
        <SettingsCard.ToggleSkeleton hasDescription />
      </SettingsCard>
    </>
  );
};

export default function TermsSettingsRoute() {
  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={SettingsCard.Error}>
        <Suspense fallback={<TermsSettingsScreen.Loading />}>
          <TermsSettingsScreen />
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
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
  const dateFormatContext = useDateFormatContext();
  const isAgreed = ConsentPolicy.hasAgreedToAiDataSharing(consent);

  const handleSelectedChange = async (agreed: boolean) => {
    if (!agreed) {
      const isConfirmed = await confirmDialog.open({
        title: t('settings:terms.aiDataSharing.withdrawTitle'),
        description: t('settings:terms.aiDataSharing.withdrawDescription'),
        confirmLabel: t('settings:terms.aiDataSharing.withdrawConfirm'),
        confirmColor: 'danger',
        cancelLabel: t('common:actions.cancel'),
        confirmTestID: 'ai-data-sharing-withdraw-confirm',
      });
      if (!isConfirmed) {
        return;
      }
    }
    updateConsent.mutate({ agreed });
  };

  return (
    <SettingsCard>
      <SettingsCard.Toggle
        label={t('settings:terms.aiDataSharing.label')}
        description={
          // 이전 안내에 동의한 사람의 글자는 서버가 그 안내의 처리 업체(Google)로만 보낸다
          ConsentPolicy.shouldShowAiConsentRenewal(consent)
            ? t('settings:terms.aiDataSharing.descriptionGoogleOnly')
            : t('settings:terms.aiDataSharing.description')
        }
        isSelected={isAgreed}
        onSelectedChange={handleSelectedChange}
        isDisabled={updateConsent.isPending}
        testID="ai-data-sharing-toggle"
      />
      <SettingsCard.Content className="pt-0">
        {match(consent)
          .with(
            { aiDataSharingDecision: 'AGREED', aiDataSharingAgreedAt: P.nonNullable },
            ({ aiDataSharingAgreedAt }) => (
              <Text size="e1" shade={6}>
                {t('settings:terms.aiDataSharing.agreedOn', {
                  date: formatDateLabel(aiDataSharingAgreedAt, 'numericDate', dateFormatContext),
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
                testID="ai-data-sharing-decline"
              >
                {t('settings:terms.aiDataSharing.decline')}
              </TextButton>
            </HStack>
          ))
          .exhaustive()}
      </SettingsCard.Content>
    </SettingsCard>
  );
}

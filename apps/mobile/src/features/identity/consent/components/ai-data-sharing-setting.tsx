import { AI_DATA_SHARING_DECISION } from '@aido/api/vocabulary';
import { formatDateLabel } from '@src/shared/date/date-format';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { HStack, SettingsListGroup, Text, TextButton, useConfirmDialog } from '@src/shared/ui';
import { useMutation, useSuspenseQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';
import { match, P } from 'ts-pattern';

import { ConsentPolicy } from '../domains/consent.model';
import { useUpdateAiDataSharingConsentMutationOptions } from '../queries/consent.mutations';
import { useGetConsentQueryOptions } from '../queries/consent.queries';

type SettingsSectionProps = Omit<ComponentProps<typeof SettingsListGroup>, 'children'>;

export function AiDataSharingSetting(props: SettingsSectionProps) {
  const { t } = useTranslation(['settings', 'common']);
  const { data: consent } = useSuspenseQuery(useGetConsentQueryOptions());
  const updateConsent = useMutation(useUpdateAiDataSharingConsentMutationOptions());
  const confirmDialog = useConfirmDialog();
  const dateFormatContext = useDateFormatContext();
  const isAgreed = ConsentPolicy.hasAgreedToAiDataSharing(consent);

  const handleSelectedChange = async (agreed: boolean) => {
    if (!agreed) {
      const isConfirmed = await confirmDialog.openAsync({
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
    <SettingsListGroup {...props}>
      <SettingsListGroup.Toggle
        label={t('settings:terms.aiDataSharing.label')}
        description={
          // 이전 안내 동의자의 글자는 그 안내의 처리 업체(Google)로만 간다
          ConsentPolicy.shouldShowAiConsentRenewal(consent)
            ? t('settings:terms.aiDataSharing.descriptionGoogleOnly')
            : t('settings:terms.aiDataSharing.description')
        }
        isSelected={isAgreed}
        onSelectedChange={handleSelectedChange}
        isDisabled={updateConsent.isPending}
        testID="ai-data-sharing-toggle"
      />
      <SettingsListGroup.Content className="pt-0">
        {match(consent)
          .with(
            {
              aiDataSharingDecision: AI_DATA_SHARING_DECISION.AGREED,
              aiDataSharingAgreedAt: P.nonNullable,
            },
            ({ aiDataSharingAgreedAt }) => (
              <Text size="e1" shade={6}>
                {t('settings:terms.aiDataSharing.agreedOn', {
                  date: formatDateLabel(aiDataSharingAgreedAt, 'numericDate', dateFormatContext),
                })}
              </Text>
            ),
          )
          .with({ aiDataSharingDecision: AI_DATA_SHARING_DECISION.AGREED }, () => null)
          .with({ aiDataSharingDecision: AI_DATA_SHARING_DECISION.DECLINED }, () => (
            <Text size="e1" shade={6}>
              {t('settings:terms.aiDataSharing.declinedStatus')}
            </Text>
          ))
          .with({ aiDataSharingDecision: AI_DATA_SHARING_DECISION.UNDECIDED }, () => (
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
      </SettingsListGroup.Content>
    </SettingsListGroup>
  );
}

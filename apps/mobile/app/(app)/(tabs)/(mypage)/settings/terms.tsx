import { AiDataSharingSetting } from '@src/features/identity/consent/components/ai-data-sharing-setting';
import { TermsAgreementList } from '@src/features/identity/consent/components/terms-agreement-list';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsListGroup, SettingsScreenLayout } from '@src/shared/ui';
import { Suspense } from 'react';

export default function TermsSettingsScreen() {
  const { t } = useTranslation('settings');

  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={TermsSettingsScreen.Error}>
        <Suspense fallback={<TermsSettingsScreen.Loading />}>
          <TermsAgreementList label={t('sections.agreements')} />

          <AiDataSharingSetting label={t('sections.dataUse')} />
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

TermsSettingsScreen.Loading = function Loading() {
  const { t } = useTranslation('settings');

  return (
    <>
      <SettingsListGroup label={t('sections.agreements')}>
        <SettingsListGroup.Item.Loading descriptionLines={2} />
        <SettingsListGroup.Separator />
        <SettingsListGroup.Item.Loading descriptionLines={2} />
      </SettingsListGroup>

      <SettingsListGroup label={t('sections.dataUse')}>
        <SettingsListGroup.Toggle.Loading hasDescription />
      </SettingsListGroup>
    </>
  );
};

TermsSettingsScreen.Error = SettingsListGroup.Error;

import { AiDataSharingSetting } from '@src/features/identity/consent/components/ai-data-sharing-setting';
import { TermsAgreementList } from '@src/features/identity/consent/components/terms-agreement-list';
import { QueryErrorBoundary, SettingsListGroup, SettingsScreenLayout } from '@src/shared/ui';
import { Suspense } from 'react';

export default function TermsSettingsScreen() {
  return (
    <SettingsScreenLayout>
      <QueryErrorBoundary fallback={SettingsListGroup.Error}>
        <Suspense fallback={<TermsSettingsScreen.Loading />}>
          <TermsAgreementList />

          <AiDataSharingSetting />
        </Suspense>
      </QueryErrorBoundary>
    </SettingsScreenLayout>
  );
}

TermsSettingsScreen.Loading = function Loading() {
  return (
    <>
      <SettingsListGroup>
        <SettingsListGroup.Item.Loading descriptionLines={2} />
        <SettingsListGroup.Separator />
        <SettingsListGroup.Item.Loading descriptionLines={2} />
      </SettingsListGroup>

      <SettingsListGroup>
        <SettingsListGroup.Toggle.Loading hasDescription />
      </SettingsListGroup>
    </>
  );
};

import { AiDataSharingSetting } from '@src/features/identity/consent/components/ai-data-sharing-setting';
import { TermsAgreementList } from '@src/features/identity/consent/components/terms-agreement-list';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsScreenLayout } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { Suspense } from 'react';

export default function TermsSettingsScreen() {
  const { t } = useTranslation('settings');

  return (
    <>
      <Stack.Screen options={{ title: t('titles.terms') }} />

      <SettingsScreenLayout>
        <QueryErrorBoundary fallback={TermsAgreementList.Error}>
          <Suspense
            fallback={
              <>
                <TermsAgreementList.Loading label={t('sections.agreements')} />

                <AiDataSharingSetting.Loading label={t('sections.dataUse')} />
              </>
            }
          >
            <TermsAgreementList label={t('sections.agreements')} />

            <AiDataSharingSetting label={t('sections.dataUse')} />
          </Suspense>
        </QueryErrorBoundary>
      </SettingsScreenLayout>
    </>
  );
}

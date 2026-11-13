import { LinkedAccountList } from '@src/features/identity/auth/components/linked-account-list';
import { useTranslation } from '@src/shared/i18n';
import { QueryErrorBoundary, SettingsScreenLayout, Text } from '@src/shared/ui';
import { Stack } from 'expo-router';
import { Suspense } from 'react';

export default function LinkedAccountsScreen() {
  const { t } = useTranslation(['auth', 'settings']);

  return (
    <>
      <Stack.Screen options={{ title: t('settings:titles.linkedAccounts') }} />

      <SettingsScreenLayout gap={8}>
        <Text size="b4" shade={6} className="px-2">
          {t('linkedAccounts.description')}
        </Text>

        <QueryErrorBoundary fallback={LinkedAccountList.Error}>
          <Suspense fallback={<LinkedAccountList.Loading />}>
            <LinkedAccountList />
          </Suspense>
        </QueryErrorBoundary>
      </SettingsScreenLayout>
    </>
  );
}

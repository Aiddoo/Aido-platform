import { SettingsMenuPane } from '@src/features/user/components/settings-menu-pane/settings-menu-pane';
import { useTranslation } from '@src/shared/i18n';
import { AdaptivePane, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  const screenOptions = useStackScreenOptions();
  const { t } = useTranslation('settings');

  const settingsStack = (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="theme" options={{ title: t('titles.theme') }} />
      <Stack.Screen name="font-size" options={{ title: t('titles.fontSize') }} />
      <Stack.Screen name="language" options={{ title: t('titles.language') }} />
      <Stack.Screen name="terms" options={{ title: t('titles.terms') }} />
      <Stack.Screen name="inquiry" options={{ title: t('titles.inquiry') }} />
      <Stack.Screen name="linked-accounts" options={{ title: t('titles.linkedAccounts') }} />
      <Stack.Screen name="app-icon" options={{ title: t('titles.appIcon') }} />
      <Stack.Screen name="profile" options={{ title: t('titles.profile') }} />
      <Stack.Screen name="edit-name" options={{ title: t('titles.editName') }} />
      <Stack.Screen name="change-password" options={{ title: t('titles.changePassword') }} />
      <Stack.Screen name="delete-account" options={{ title: t('titles.deleteAccount') }} />
      <Stack.Screen name="subscription" options={{ title: t('titles.subscription') }} />
      <Stack.Screen name="category-settings" options={{ title: t('titles.categorySettings') }} />
    </Stack>
  );

  return (
    <AdaptivePane
      primary={<SettingsMenuPane />}
      secondary={settingsStack}
      compactPane="secondary"
    />
  );
}

import { SettingsMenuPane } from '@src/features/user/components/settings-menu-pane/settings-menu-pane';
import { useTranslation } from '@src/shared/i18n';
import { AdaptivePane, useStackBackToolbar, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  const screenOptions = useStackScreenOptions();
  const backToolbar = useStackBackToolbar();
  const { t } = useTranslation('settings');

  const settingsStack = (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="theme" options={{ title: t('titles.theme') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="font-size" options={{ title: t('titles.fontSize') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="language" options={{ title: t('titles.language') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="terms" options={{ title: t('titles.terms') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="inquiry" options={{ title: t('titles.inquiry') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="linked-accounts" options={{ title: t('titles.linkedAccounts') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="app-icon" options={{ title: t('titles.appIcon') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="profile" options={{ title: t('titles.profile') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="edit-name" options={{ title: t('titles.editName') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="change-password" options={{ title: t('titles.changePassword') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="delete-account" options={{ title: t('titles.deleteAccount') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="subscription" options={{ title: t('titles.subscription') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="category-settings" options={{ title: t('titles.categorySettings') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="blocked-users" options={{ title: t('titles.blockedUsers') }}>
        {backToolbar}
      </Stack.Screen>
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

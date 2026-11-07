import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { useTranslation } from '@src/shared/i18n';
import { useStackBackToolbar, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function SettingsLayout() {
  const screenOptions = useStackScreenOptions({ hasContentBackground: true });
  const backToolbar = useStackBackToolbar();
  const { t } = useTranslation('settings');

  const isCompact = useWindowSizeClass() === 'compact';
  const menuScreenAnimation = isCompact ? 'default' : 'none';

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen
        name="notifications"
        options={{ headerShown: false, animation: menuScreenAnimation }}
      />
      <Stack.Screen
        name="theme"
        options={{ title: t('titles.theme'), animation: menuScreenAnimation }}
      >
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen
        name="font-size"
        options={{ title: t('titles.fontSize'), animation: menuScreenAnimation }}
      >
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen
        name="language"
        options={{ title: t('titles.language'), animation: menuScreenAnimation }}
      >
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen
        name="voice-storage"
        options={{ title: t('titles.voiceStorage'), animation: menuScreenAnimation }}
      >
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen
        name="terms"
        options={{ title: t('titles.terms'), animation: menuScreenAnimation }}
      >
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen
        name="inquiry"
        options={{ title: t('titles.inquiry'), animation: menuScreenAnimation }}
      >
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="linked-accounts" options={{ title: t('titles.linkedAccounts') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen
        name="app-icon"
        options={{ title: t('titles.appIcon'), animation: menuScreenAnimation }}
      >
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen
        name="profile"
        options={{ title: t('titles.profile'), animation: menuScreenAnimation }}
      >
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
      <Stack.Screen
        name="subscription"
        options={{ title: t('titles.subscription'), animation: menuScreenAnimation }}
      >
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen
        name="category-settings"
        options={{ title: t('titles.categorySettings'), animation: menuScreenAnimation }}
      >
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen
        name="blocked-users"
        options={{ title: t('titles.blockedUsers'), animation: menuScreenAnimation }}
      >
        {backToolbar}
      </Stack.Screen>
    </Stack>
  );
}

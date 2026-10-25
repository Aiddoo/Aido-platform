import { useTranslation } from '@src/shared/i18n';
import { useStackBackToolbar, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function NotificationsSettingsLayout() {
  const screenOptions = useStackScreenOptions();
  const backToolbar = useStackBackToolbar();
  const { t } = useTranslation('notification');

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t('titles.settings') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="push" options={{ title: t('titles.push') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="weather" options={{ title: t('titles.weather') }}>
        {backToolbar}
      </Stack.Screen>
      <Stack.Screen name="reminder" options={{ title: t('titles.reminder') }}>
        {backToolbar}
      </Stack.Screen>
    </Stack>
  );
}

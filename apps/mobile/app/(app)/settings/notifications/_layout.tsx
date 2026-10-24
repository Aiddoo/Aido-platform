import { useTranslation } from '@src/shared/i18n';
import { useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function NotificationsSettingsLayout() {
  const screenOptions = useStackScreenOptions();
  const { t } = useTranslation('notification');

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t('titles.settings') }} />
      <Stack.Screen name="push" options={{ title: t('titles.push') }} />
      <Stack.Screen name="weather" options={{ title: t('titles.weather') }} />
      <Stack.Screen name="reminder" options={{ title: t('titles.reminder') }} />
    </Stack>
  );
}

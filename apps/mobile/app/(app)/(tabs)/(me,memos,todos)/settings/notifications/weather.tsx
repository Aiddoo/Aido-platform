import { WeatherNotificationSettings } from '@src/features/notification/components/weather-notification-settings';
import { useTranslation } from '@src/shared/i18n';
import { Stack } from 'expo-router';

export default function WeatherSettingsScreen() {
  const { t } = useTranslation('notification');

  return (
    <>
      <Stack.Screen options={{ title: t('titles.weather') }} />
      <WeatherNotificationSettings />
    </>
  );
}

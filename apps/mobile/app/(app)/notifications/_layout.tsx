import { useTranslation } from '@src/shared/i18n';
import { useStackBackToolbar, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

function NotificationsLayout() {
  const screenOptions = useStackScreenOptions({ background: 'bg-white' });
  const backToolbar = useStackBackToolbar({ fallbackHref: '/feed' });
  const { t } = useTranslation('notification');

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t('titles.notifications') }}>
        {backToolbar}
      </Stack.Screen>
    </Stack>
  );
}

export default NotificationsLayout;

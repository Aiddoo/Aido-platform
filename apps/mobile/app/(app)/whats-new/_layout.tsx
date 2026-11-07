import { useTranslation } from '@src/shared/i18n';
import { useStackBackToolbar, useStackScreenOptions } from '@src/shared/ui';
import { Stack } from 'expo-router';

export default function WhatsNewLayout() {
  const screenOptions = useStackScreenOptions({ hasContentBackground: true });
  const backToolbar = useStackBackToolbar({ fallbackHref: '/mypage' });
  const { t } = useTranslation('whatsNew');

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen name="releases" options={{ title: t('list.title') }}>
        {backToolbar}
      </Stack.Screen>
    </Stack>
  );
}

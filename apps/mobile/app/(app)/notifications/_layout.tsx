import Send from '@expo/material-symbols/send.xml';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { useStackBackToolbar, useStackScreenOptions } from '@src/shared/ui';
import { Stack, router } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

function NotificationsLayout() {
  const screenOptions = useStackScreenOptions({ background: 'bg-white' });
  const backToolbar = useStackBackToolbar({ fallbackHref: '/feed' });
  const { color: brandColor } = useResolveClassNames('text-main');
  const { t } = useTranslation(['notification', 'todo']);
  const openSentNudges = useSingleTap(() => router.navigate('/nudges/sent'));

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" options={{ title: t('titles.notifications') }}>
        {backToolbar}
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={process.env.EXPO_OS === 'ios' ? undefined : Send}
            accessibilityLabel={t('todo:interaction.sent')}
            tintColor={brandColor}
            onPress={openSentNudges}
          >
            {t('todo:interaction.sent')}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      </Stack.Screen>
    </Stack>
  );
}

export default NotificationsLayout;

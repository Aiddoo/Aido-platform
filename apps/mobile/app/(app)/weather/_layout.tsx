import Settings from '@expo/material-symbols/settings.xml';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { useStackBackToolbar } from '@src/shared/ui';
import { router, Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

const SETTINGS_ICON = process.env.EXPO_OS === 'ios' ? 'gearshape' : Settings;

export default function WeatherLayout() {
  const { t } = useTranslation('weather');
  const backToolbar = useStackBackToolbar({ fallbackHref: '/feed' });
  const push = useSingleTap(router.push);
  const { color: tintColor } = useResolveClassNames('text-white');
  const { backgroundColor } = useResolveClassNames('bg-gray-10');

  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        headerTintColor: typeof tintColor === 'string' ? tintColor : undefined,
        title: '',
        statusBarStyle: 'light',
        contentStyle: { backgroundColor },
      }}
    >
      <Stack.Screen name="index">
        {backToolbar}
        <Stack.Toolbar placement="right">
          <Stack.Toolbar.Button
            icon={SETTINGS_ICON}
            accessibilityLabel={t('titles.settings')}
            onPress={() => push('/settings/notifications/weather')}
          />
        </Stack.Toolbar>
      </Stack.Screen>
    </Stack>
  );
}

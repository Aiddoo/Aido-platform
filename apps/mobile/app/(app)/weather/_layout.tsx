import { WeatherBackground } from '@src/features/weather/presentations/components/WeatherBackground';
import { TimePaletteContext } from '@src/features/weather/presentations/hooks/use-time-palette';
import { useWeatherSession } from '@src/features/weather/presentations/providers/weather-session-provider';
import { getWeatherPalette } from '@src/features/weather/presentations/view-models/weather-palette.view-model';
import { useSingleTap } from '@src/shared/hooks/useSingleTap';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { useTheme } from '@src/shared/providers/theme-provider';
import { Box } from '@src/shared/ui';
import { ArrowLeftIcon, SettingIcon } from '@src/shared/ui';
import { getScaledFontSize } from '@src/shared/utils/font-scale';
import { Stack, router } from 'expo-router';
import { Pressable, View } from 'react-native';

const WeatherLayout = () => {
  const goBack = useSingleTap(router.back);
  const push = useSingleTap(router.push);

  const { t } = useTranslation('weather');
  const { resolvedTheme } = useTheme();
  const { clock } = useWeatherSession();
  const palette = getWeatherPalette(clock.deviceHour, resolvedTheme);
  const { fontScale } = useFontScale();
  return (
    <TimePaletteContext.Provider value={palette}>
      <Box flex={1} style={{ backgroundColor: palette.bg }}>
        <WeatherBackground />
        <Stack
          screenOptions={{
            headerShown: true,
            headerTransparent: true,
            headerShadowVisible: false,
            contentStyle: { backgroundColor: 'transparent' },
            headerTintColor: palette.text,
            statusBarStyle: 'light',
            headerTitleStyle: {
              fontSize: getScaledFontSize(fontScale),
              fontWeight: '600',
              color: palette.text,
            },
            headerTitleAlign: 'center',
            headerLeft: () => (
              <View className="justify-center items-center">
                <Pressable
                  accessibilityLabel={t('titles.back')}
                  onPress={() => goBack()}
                  hitSlop={8}
                  className="p-3"
                  accessibilityRole="button"
                >
                  <ArrowLeftIcon width={20} height={20} color={palette.text} />
                </Pressable>
              </View>
            ),
            headerRight: () => (
              <View className="justify-center items-center">
                <Pressable
                  accessibilityLabel={t('titles.settings')}
                  onPress={() => push('/settings/notifications/weather')}
                  hitSlop={8}
                  className="p-3"
                  accessibilityRole="button"
                >
                  <SettingIcon width={20} height={20} color={palette.text} />
                </Pressable>
              </View>
            ),
          }}
        >
          <Stack.Screen name="index" options={{ title: t('titles.index') }} />
        </Stack>
      </Box>
    </TimePaletteContext.Provider>
  );
};

export default WeatherLayout;

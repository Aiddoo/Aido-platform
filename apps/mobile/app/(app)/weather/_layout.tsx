import { WeatherBackground } from '@src/features/weather/components/weather-background';
import { TimePaletteContext } from '@src/features/weather/hooks/use-time-palette';
import { useWeatherSession } from '@src/features/weather/hooks/weather-session-provider';
import { getWeatherPalette } from '@src/features/weather/utils/view-models/weather-palette.view-model';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { useTheme } from '@src/shared/providers/theme-provider';
import { ArrowLeftIcon, Box, HStack, SettingIcon, StyledSafeAreaView, Text } from '@src/shared/ui';
import { Slot, Stack, router } from 'expo-router';
import { Pressable } from 'react-native';

export default function WeatherLayout() {
  const { resolvedTheme } = useTheme();
  const { clock } = useWeatherSession();
  const palette = getWeatherPalette(clock.deviceHour, resolvedTheme);

  return (
    <TimePaletteContext.Provider value={palette}>
      <Stack.Screen
        options={{
          headerShown: true,
          headerTransparent: true,
          headerShadowVisible: false,
          header: () => <WeatherLayout.Header />,
          contentStyle: { backgroundColor: palette.bg },
          statusBarStyle: 'light',
        }}
      />
      <Box flex={1} style={{ backgroundColor: palette.bg }}>
        <WeatherBackground />
        <Slot />
      </Box>
    </TimePaletteContext.Provider>
  );
}

WeatherLayout.Header = function Header() {
  const { t } = useTranslation('weather');
  const { resolvedTheme } = useTheme();
  const { clock } = useWeatherSession();
  const palette = getWeatherPalette(clock.deviceHour, resolvedTheme);
  const goBack = useSingleTap(router.back);
  const push = useSingleTap(router.push);

  return (
    <StyledSafeAreaView edges={['top', 'left', 'right']}>
      <HStack align="center" px={12} py={8}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('titles.back')}
          onPress={() => goBack()}
          className="h-11 w-11 items-center justify-center"
        >
          <ArrowLeftIcon width={20} height={20} color={palette.text} />
        </Pressable>
        <Box flex={1}>
          <Text size="b2" weight="semibold" align="center" style={{ color: palette.text }}>
            {t('titles.index')}
          </Text>
        </Box>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('titles.settings')}
          onPress={() => push('/settings/notifications/weather')}
          className="h-11 w-11 items-center justify-center"
        >
          <SettingIcon width={20} height={20} color={palette.text} />
        </Pressable>
      </HStack>
    </StyledSafeAreaView>
  );
};

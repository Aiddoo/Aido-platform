import Notifications from '@expo/material-symbols/notifications.xml';
import Refresh from '@expo/material-symbols/refresh.xml';
import { WeatherLocationPolicy } from '@src/features/weather/domains/weather-location.model';
import { useOnSkyColor } from '@src/features/weather/hooks/use-on-sky-color';
import { useWeatherLocation } from '@src/features/weather/hooks/use-weather-location';
import {
  refetchWeather,
  getWeatherReportsFilters,
} from '@src/features/weather/queries/weather-cache';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { SHEET_ROUTE_SCREEN_OPTIONS, useStackBackToolbar } from '@src/shared/ui';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

const ALERT_SETTINGS_ICON = process.env.EXPO_OS === 'ios' ? 'bell' : Notifications;
const REFRESH_ICON = process.env.EXPO_OS === 'ios' ? 'arrow.clockwise' : Refresh;

export default function WeatherLayout() {
  const { t } = useTranslation('weather');
  /** 하늘 장면 위 헤더 버튼의 둥근 유리 면. iOS는 네이티브 유리 버튼이 그린다. */
  const headerButtonContainerColor = useOnSkyColor('text-on-sky/16');
  const backToolbar = useStackBackToolbar({
    fallbackHref: '/feed',
    buttonContainerColor: headerButtonContainerColor,
  });
  const push = useSingleTap(router.push);
  const queryClient = useQueryClient();
  const isRefreshing = useIsFetching(getWeatherReportsFilters()) > 0;
  const location = useWeatherLocation();
  const canRefresh = WeatherLocationPolicy.shouldFetchReport(location.status);
  const tintColor = useOnSkyColor('text-on-sky');
  const { backgroundColor } = useResolveClassNames('bg-gray-10');

  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        headerTintColor: tintColor,
        title: '',
        statusBarStyle: 'light',
        contentStyle: { backgroundColor },
      }}
    >
      <Stack.Screen name="index" options={{ scrollEdgeEffects: { top: 'soft' } }}>
        {backToolbar}
        <Stack.Toolbar placement="right" buttonContainerColor={headerButtonContainerColor}>
          <Stack.Toolbar.Button
            icon={REFRESH_ICON}
            accessibilityLabel={t('attribution.refresh')}
            hidden={!canRefresh}
            disabled={isRefreshing}
            onPress={() => refetchWeather(queryClient)}
          >
            {t('attribution.refresh')}
          </Stack.Toolbar.Button>
          <Stack.Toolbar.Button
            icon={ALERT_SETTINGS_ICON}
            accessibilityLabel={t('titles.settings')}
            onPress={() => push('/settings/notifications/weather')}
          >
            {t('titles.settings')}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      </Stack.Screen>
      <Stack.Screen name="reschedule" options={SHEET_ROUTE_SCREEN_OPTIONS} />
    </Stack>
  );
}

import Notifications from '@expo/material-symbols/notifications.xml';
import Refresh from '@expo/material-symbols/refresh.xml';
import { WeatherLocationPolicy } from '@src/features/weather/domains/weather-location.model';
import { useWeatherLocation } from '@src/features/weather/hooks/use-weather-location';
import {
  refetchWeather,
  getWeatherReportsFilters,
} from '@src/features/weather/queries/weather-cache';
import { useResolvedColor } from '@src/shared/hooks/use-resolved-color';
import { useSingleTap } from '@src/shared/hooks/use-single-tap';
import { useTranslation } from '@src/shared/i18n';
import { useAppTheme } from '@src/shared/providers/theme-provider';
import {
  SHEET_ROUTE_SCREEN_OPTIONS,
  useStackBackToolbar,
  useStackScreenOptions,
} from '@src/shared/ui';
import { useIsFetching, useQueryClient } from '@tanstack/react-query';
import { router, Stack } from 'expo-router';
import { useResolveClassNames } from 'uniwind';

const ALERT_SETTINGS_ICON = process.env.EXPO_OS === 'ios' ? 'bell' : Notifications;
const REFRESH_ICON = process.env.EXPO_OS === 'ios' ? 'arrow.clockwise' : Refresh;

export default function WeatherLayout() {
  const { t } = useTranslation(['weather', 'notification']);
  const location = useWeatherLocation();
  // 리포트가 없으면 하늘 장면 대신 흰 면의 위치 권한 안내라 기본 헤더 색을 쓴다
  const isSkyScene = WeatherLocationPolicy.shouldFetchReport(location);
  /** 하늘 장면 위 헤더 버튼의 둥근 유리 면. iOS는 네이티브 유리 버튼이 그린다. */
  const skyButtonContainerColor = useResolvedColor('text-on-sky/16');
  const headerButtonContainerColor = isSkyScene ? skyButtonContainerColor : undefined;
  const backToolbar = useStackBackToolbar({
    fallbackHref: '/feed',
    buttonContainerColor: headerButtonContainerColor,
  });
  const push = useSingleTap(router.push);
  const queryClient = useQueryClient();
  const isRefreshing = useIsFetching(getWeatherReportsFilters()) > 0;
  const skyTintColor = useResolvedColor('text-on-sky');
  const surfaceTintColor = useResolvedColor('text-gray-9');
  const { resolvedTheme } = useAppTheme();
  const { backgroundColor } = useResolveClassNames('bg-gray-10');
  const settingsHeaderOptions = useStackScreenOptions({ hasContentBackground: true });

  return (
    <Stack
      screenOptions={{
        headerTransparent: true,
        headerShadowVisible: false,
        headerTintColor: isSkyScene ? skyTintColor : surfaceTintColor,
        title: '',
        statusBarStyle: isSkyScene || resolvedTheme === 'dark' ? 'light' : 'dark',
        contentStyle: { backgroundColor },
      }}
    >
      <Stack.Screen name="index" options={{ scrollEdgeEffects: { top: 'soft' } }}>
        {backToolbar}
        <Stack.Toolbar placement="right" buttonContainerColor={headerButtonContainerColor}>
          <Stack.Toolbar.Button
            icon={REFRESH_ICON}
            accessibilityLabel={t('attribution.refresh')}
            hidden={!isSkyScene}
            disabled={isRefreshing}
            onPress={() => refetchWeather(queryClient)}
          >
            {t('attribution.refresh')}
          </Stack.Toolbar.Button>
          <Stack.Toolbar.Button
            icon={ALERT_SETTINGS_ICON}
            accessibilityLabel={t('titles.settings')}
            onPress={() => push('/weather/settings')}
          >
            {t('titles.settings')}
          </Stack.Toolbar.Button>
        </Stack.Toolbar>
      </Stack.Screen>
      {/* 마이 탭의 같은 설정으로 보내면 탭 묶음이 날씨 위에 새로 쌓여 뒤로 갈 곳이 없다. 날씨 Stack에 열어 네이티브 뒤로 가기가 날씨로 돌아간다 */}
      <Stack.Screen
        name="settings"
        options={{
          ...settingsHeaderOptions,
          headerTransparent: false,
          title: t('notification:titles.weather'),
          statusBarStyle: resolvedTheme === 'dark' ? 'light' : 'dark',
        }}
      />
      <Stack.Screen name="reschedule" options={SHEET_ROUTE_SCREEN_OPTIONS} />
    </Stack>
  );
}

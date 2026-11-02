import { DailyForecast } from '@src/features/weather/components/daily-forecast';
import { HourlyForecast } from '@src/features/weather/components/hourly-forecast';
import { NextHourPrecipitation } from '@src/features/weather/components/next-hour-precipitation';
import { WeatherAlerts } from '@src/features/weather/components/weather-alerts';
import { WeatherAttribution } from '@src/features/weather/components/weather-attribution';
import { WeatherBriefing } from '@src/features/weather/components/weather-briefing';
import { WeatherDetailGrid } from '@src/features/weather/components/weather-detail-grid';
import { WeatherHero } from '@src/features/weather/components/weather-hero';
import { WeatherLocationPrompt } from '@src/features/weather/components/weather-location-prompt';
import { WeatherSceneCanvas } from '@src/features/weather/components/weather-scene/weather-scene-canvas';
import {
  toWeatherScene,
  type WeatherSceneInput,
} from '@src/features/weather/domains/weather-scene.model';
import {
  useWeatherLocation,
  useWeatherLocationRevision,
} from '@src/features/weather/hooks/use-weather-location';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '@src/features/weather/queries/get-weather-report-query-options';
import { refetchWeather } from '@src/features/weather/queries/weather-cache';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { Box, QueryErrorBoundary, Spacing, StyledSafeAreaView, VStack } from '@src/shared/ui';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { type ComponentProps, type PropsWithChildren, Suspense } from 'react';
import { RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { match } from 'ts-pattern';

/** 리포트를 받기 전·권한 안내 중에는 맑은 낮 하늘을 바탕으로 둔다. */
const DEFAULT_SCENE_INPUT: WeatherSceneInput = {
  condition: 'CLEAR',
  isDaylight: true,
  precipitationIntensity: 0,
  cloudCover: 0,
  windSpeed: 0,
};
const SCREEN_GUTTER = 16;
const BLOCK_GAP = 12;
/** 시간별 예보 위에 앉은 고양이 자리 */
const MASCOT_SPACE = 56;

export default function WeatherScreen() {
  const location = useWeatherLocation();

  return (
    <>
      <WeatherBackground />
      <WeatherScrollView>
        {match(location)
          .with({ status: 'needsPermission' }, { status: 'denied' }, () => (
            <Box px={SCREEN_GUTTER} className="flex-1 justify-center">
              <WeatherLocationPrompt />
            </Box>
          ))
          .with({ status: 'checking' }, { status: 'unavailable' }, { status: 'ready' }, () => (
            <WeatherReportSections />
          ))
          .exhaustive()}
      </WeatherScrollView>
    </>
  );
}

/**
 * 위치를 확인하는 동안에도 서버에 저장된 위치로 리포트를 바로 받는다.
 * 모든 블록이 한 요청을 공유하므로 오류는 경계 하나에서 한 번만 보이고, 로딩은 블록마다 따로 풀린다.
 */
function WeatherReportSections() {
  const locationRevision = useWeatherLocationRevision();

  return (
    <QueryErrorBoundary fallback={WeatherReportFallback} resetKeys={[locationRevision]}>
      <VStack px={SCREEN_GUTTER}>
        <WeatherLocationPrompt.SavedLocationNotice />

        <Suspense fallback={<WeatherHero.Loading />}>
          <WeatherHero />
        </Suspense>

        <Spacing size={28} />

        <VStack gap={BLOCK_GAP}>
          <QueryErrorBoundary fallback={WeatherBriefing.Error}>
            <Suspense fallback={<WeatherBriefing.Loading />}>
              <WeatherBriefing />
            </Suspense>
          </QueryErrorBoundary>
          <Suspense fallback={<NextHourPrecipitation.Loading />}>
            <NextHourPrecipitation />
          </Suspense>
          <Suspense fallback={<WeatherAlerts.Loading />}>
            <WeatherAlerts />
          </Suspense>
          <Spacing size={MASCOT_SPACE} />
          <Suspense fallback={<HourlyForecast.Loading />}>
            <HourlyForecast />
          </Suspense>
          <Suspense fallback={<DailyForecast.Loading />}>
            <DailyForecast />
          </Suspense>
          <Suspense fallback={<WeatherDetailGrid.Loading />}>
            <WeatherDetailGrid />
          </Suspense>
          <Suspense fallback={<WeatherAttribution.Loading />}>
            <WeatherAttribution background="dark" />
          </Suspense>
        </VStack>
      </VStack>
    </QueryErrorBoundary>
  );
}

/** 리포트 오류·위치 안내는 권한 안내와 같은 자리(가로 여백, 세로 가운데)에 둔다. */
function WeatherReportFallback(props: ComponentProps<typeof WeatherHero.Error>) {
  return (
    <Box px={SCREEN_GUTTER} className="flex-1 justify-center">
      <WeatherHero.Error {...props} />
    </Box>
  );
}

function WeatherScrollView({ children }: PropsWithChildren) {
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [isRefreshing, refresh] = useRefresh(() => refetchWeather(queryClient));

  return (
    <ScrollView
      contentInsetAdjustmentBehavior="never"
      contentContainerStyle={{
        flexGrow: 1,
        paddingTop: headerHeight + 8,
        paddingBottom: insets.bottom + 24,
      }}
      refreshControl={
        <RefreshControl tintColor="white" refreshing={isRefreshing} onRefresh={refresh} />
      }
    >
      <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
        {children}
      </StyledSafeAreaView>
    </ScrollView>
  );
}

/**
 * 하늘 장면은 리포트가 없거나 실패해도 화면을 막지 않도록 Suspense·오류 경계 밖에서 구독하고,
 * 받기 전에는 기본 장면을 그린다.
 */
function WeatherBackground() {
  const location = useWeatherLocation();
  const { data: sceneInput } = useQuery({
    ...useGetWeatherReportQueryOptions(),
    select: WeatherReportSelect.scene,
    enabled: location.status !== 'needsPermission' && location.status !== 'denied',
  });
  return <WeatherSceneCanvas scene={toWeatherScene(sceneInput ?? DEFAULT_SCENE_INPUT)} />;
}

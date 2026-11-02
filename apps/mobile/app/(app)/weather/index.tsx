import { DailyForecast } from '@src/features/weather/components/daily-forecast';
import { HourlyForecast } from '@src/features/weather/components/hourly-forecast';
import { NextHourPrecipitation } from '@src/features/weather/components/next-hour-precipitation';
import { WeatherAirQuality } from '@src/features/weather/components/weather-air-quality';
import { WeatherAlerts } from '@src/features/weather/components/weather-alerts';
import { WeatherAttribution } from '@src/features/weather/components/weather-attribution';
import { WeatherBriefing } from '@src/features/weather/components/weather-briefing';
import { WeatherDetailGrid } from '@src/features/weather/components/weather-detail-grid';
import { WeatherHero } from '@src/features/weather/components/weather-hero';
import { WeatherLocationPrompt } from '@src/features/weather/components/weather-location-prompt';
import { WeatherSceneCanvas } from '@src/features/weather/components/weather-scene/weather-scene-canvas';
import { WeatherSunMoon } from '@src/features/weather/components/weather-sun-moon';
import { WeatherTopFade } from '@src/features/weather/components/weather-top-fade';
import { useOnSkyColor } from '@src/features/weather/hooks/use-on-sky-color';
import { useWeatherLocation } from '@src/features/weather/hooks/use-weather-location';
import { useWeatherScene } from '@src/features/weather/hooks/use-weather-scene';
import { useWeatherScreenTracking } from '@src/features/weather/hooks/use-weather-screen-tracking';
import { useWeatherLocationRevision } from '@src/features/weather/queries/get-weather-location-query-options';
import { refetchWeather } from '@src/features/weather/queries/weather-cache';
import { useRefresh } from '@src/shared/hooks/use-refresh';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import {
  AdaptivePane,
  Box,
  QueryErrorBoundary,
  Spacing,
  StyledSafeAreaView,
  VStack,
} from '@src/shared/ui';
import { useQueryClient } from '@tanstack/react-query';
import { useHeaderHeight } from 'expo-router/react-navigation';
import { type ComponentProps, type PropsWithChildren, Suspense } from 'react';
import { Platform, RefreshControl, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { match } from 'ts-pattern';

const SCREEN_GUTTER = 16;
const HERO_GUTTER = 24;
const HERO_TOP = 6;
const CARDS_TOP = 32;
const BLOCK_GAP = 12;
/** 넓은 pane에서 카드가 과하게 늘어나지 않게 하는 최대 폭 */
const COLUMN_MAX_WIDTH = 560;
/** 헤더 아래로 페이드가 이어지는 길이 */
const TOP_FADE_EXTENT = 40;
const IS_IOS = process.env.EXPO_OS === 'ios';
/** iOS 26부터는 투명 헤더 아래 내용을 시스템 스크롤 엣지 효과가 흐리므로 직접 그린 페이드를 쓰지 않는다. */
const HAS_NATIVE_EDGE_EFFECT = IS_IOS && Number.parseInt(String(Platform.Version), 10) >= 26;

export default function WeatherScreen() {
  const location = useWeatherLocation();
  useWeatherScreenTracking(location.status);

  return (
    <>
      <WeatherBackground />
      {match(location)
        .with({ status: 'needsPermission' }, { status: 'denied' }, () => (
          <WeatherStatusView>
            <WeatherLocationPrompt />
          </WeatherStatusView>
        ))
        .with({ status: 'checking' }, { status: 'unavailable' }, { status: 'ready' }, () => (
          <WeatherReportSections />
        ))
        .exhaustive()}
    </>
  );
}

/**
 * 위치를 확인하는 동안에도 서버에 저장된 위치로 리포트를 바로 받는다.
 * 모든 블록이 한 요청을 공유하므로 오류는 경계 하나에서 한 번만 보이고, 로딩은 블록마다 따로 풀린다.
 * 좁은 창은 한 단, 넓은 창(iPad·Duo 펼침)은 지금 날씨와 예보·상세를 두 단으로 나누고 각 단을 따로 스크롤한다.
 */
function WeatherReportSections() {
  const locationRevision = useWeatherLocationRevision();
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <QueryErrorBoundary fallback={WeatherReportFallback} resetKeys={[locationRevision]}>
      <AdaptivePane
        primary={
          <WeatherScrollView>
            <WeatherColumn>
              <WeatherNowBlocks />
              {isCompact && (
                <>
                  <Spacing size={BLOCK_GAP} />
                  <WeatherForecastBlocks />
                </>
              )}
            </WeatherColumn>
          </WeatherScrollView>
        }
        secondary={
          <WeatherScrollView>
            <WeatherColumn>
              <WeatherForecastBlocks />
            </WeatherColumn>
          </WeatherScrollView>
        }
      />
    </QueryErrorBoundary>
  );
}

function WeatherColumn({ children }: PropsWithChildren) {
  return (
    <Box className="w-full self-center" style={{ maxWidth: COLUMN_MAX_WIDTH }}>
      {children}
    </Box>
  );
}

function WeatherNowBlocks() {
  return (
    <>
      <Box px={SCREEN_GUTTER}>
        <WeatherLocationPrompt.SavedLocationNotice />
      </Box>
      <Box pt={HERO_TOP} px={HERO_GUTTER}>
        <Suspense fallback={<WeatherHero.Loading />}>
          <WeatherHero />
        </Suspense>
      </Box>
      <VStack gap={BLOCK_GAP} pt={CARDS_TOP} px={SCREEN_GUTTER}>
        <Suspense fallback={<WeatherAlerts.Loading />}>
          <WeatherAlerts />
        </Suspense>
        <QueryErrorBoundary fallback={WeatherBriefing.Error}>
          <Suspense fallback={<WeatherBriefing.Loading />}>
            <WeatherBriefing />
          </Suspense>
        </QueryErrorBoundary>
        <Suspense fallback={<NextHourPrecipitation.Loading />}>
          <NextHourPrecipitation />
        </Suspense>
        <Suspense fallback={<HourlyForecast.Loading />}>
          <HourlyForecast />
        </Suspense>
      </VStack>
    </>
  );
}

function WeatherForecastBlocks() {
  return (
    <VStack gap={BLOCK_GAP} px={SCREEN_GUTTER}>
      <Suspense fallback={<DailyForecast.Loading />}>
        <DailyForecast />
      </Suspense>
      <Suspense fallback={<WeatherDetailGrid.Loading />}>
        <WeatherDetailGrid />
      </Suspense>
      <Suspense fallback={<WeatherSunMoon.Loading />}>
        <WeatherSunMoon />
      </Suspense>
      <Suspense fallback={<WeatherAirQuality.Loading />}>
        <WeatherAirQuality />
      </Suspense>
      <Suspense fallback={<WeatherAttribution.Loading />}>
        <WeatherAttribution background="dark" />
      </Suspense>
    </VStack>
  );
}

/** 리포트 오류·위치 안내는 권한 안내와 같은 자리(가로 여백, 세로 가운데)에 둔다. */
function WeatherReportFallback(props: ComponentProps<typeof WeatherHero.Error>) {
  return (
    <WeatherStatusView>
      <WeatherHero.Error {...props} />
    </WeatherStatusView>
  );
}

/**
 * 권한 안내·오류처럼 한 덩어리만 보여 주는 상태를 헤더 아래 보이는 영역의 세로 가운데에 둔다.
 * iOS는 헤더 높이만큼 내용이 자동으로 내려가므로 그만큼 아래 여백을 더해 가운데를 맞춘다.
 */
function WeatherStatusView({ children }: PropsWithChildren) {
  const headerHeight = useHeaderHeight();

  return (
    <WeatherScrollView bottomInset={IS_IOS ? headerHeight : 0}>
      <Box px={SCREEN_GUTTER} className="flex-1 justify-center">
        {children}
      </Box>
    </WeatherScrollView>
  );
}

interface WeatherScrollViewProps extends PropsWithChildren {
  /** 기본 아래 여백에 더할 높이 */
  bottomInset?: number;
}

function WeatherScrollView({ children, bottomInset = 0 }: WeatherScrollViewProps) {
  const queryClient = useQueryClient();
  const headerHeight = useHeaderHeight();
  const insets = useSafeAreaInsets();
  const [isRefreshing, refresh] = useRefresh(() => refetchWeather(queryClient));
  const refreshTint = useOnSkyColor('text-on-sky');

  return (
    <Box flex={1}>
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{
          flexGrow: 1,
          paddingTop: IS_IOS ? 0 : headerHeight,
          paddingBottom: insets.bottom + 24 + bottomInset,
        }}
        refreshControl={
          <RefreshControl
            tintColor={refreshTint}
            progressViewOffset={IS_IOS ? undefined : headerHeight}
            refreshing={isRefreshing}
            onRefresh={refresh}
          />
        }
      >
        <StyledSafeAreaView edges={['left', 'right']} className="flex-1">
          {children}
        </StyledSafeAreaView>
      </ScrollView>
      {!HAS_NATIVE_EDGE_EFFECT && (
        <WeatherTopFade solidHeight={insets.top} height={headerHeight + TOP_FADE_EXTENT} />
      )}
    </Box>
  );
}

function WeatherBackground() {
  return <WeatherSceneCanvas scene={useWeatherScene()} />;
}

import { DailyForecast } from '@src/features/weather/components/daily-forecast';
import { DevOverrideBadge } from '@src/features/weather/components/dev-override-badge';
import { HourlyForecast } from '@src/features/weather/components/hourly-forecast';
import { NextHourPrecipitation } from '@src/features/weather/components/next-hour-precipitation';
import { WeatherAirQuality } from '@src/features/weather/components/weather-air-quality';
import { WeatherAlerts } from '@src/features/weather/components/weather-alerts';
import { WeatherAttribution } from '@src/features/weather/components/weather-attribution';
import { WeatherBackground } from '@src/features/weather/components/weather-background';
import { WeatherBriefing } from '@src/features/weather/components/weather-briefing';
import { WeatherDetailGrid } from '@src/features/weather/components/weather-detail-grid';
import { WeatherHero } from '@src/features/weather/components/weather-hero';
import { WeatherLocationPrompt } from '@src/features/weather/components/weather-location-prompt';
import { WeatherScrollView } from '@src/features/weather/components/weather-scroll-view';
import { WeatherSunMoon } from '@src/features/weather/components/weather-sun-moon';
import type { WeatherLocationStatus } from '@src/features/weather/domains/weather-location.model';
import { useWeatherLocation } from '@src/features/weather/hooks/use-weather-location';
import { useWeatherLocationRevision } from '@src/features/weather/queries/weather.queries';
import { weatherEntryParamsSchema } from '@src/features/weather/schemas/weather-entry-params.schema';
import {
  toWeatherLocationRegisteredResult,
  toWeatherOpenedEntry,
} from '@src/features/weather/utils/weather-analytics';
import { useTrack } from '@src/shared/analytics';
import { useRouteParams } from '@src/shared/hooks/use-route-params';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import {
  AdaptivePane,
  Box,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  ReadableContent,
  Spacing,
  VStack,
} from '@src/shared/ui';
import { Suspense, useEffect, useRef } from 'react';
import { match } from 'ts-pattern';

const SCREEN_GUTTER = 16;
const HERO_GUTTER = 24;
const HERO_TOP = 6;
const CARDS_TOP = 32;
const CARD_GAP = 12;
/** 넓은 pane에서 카드가 과하게 늘어나지 않게 하는 최대 폭 */
const COLUMN_STYLE = { maxWidth: 560 };

/** 위치 확인 중에도 서버 저장 위치로 리포트를 바로 받는다. 모든 카드가 한 요청을 공유해 오류는 경계 하나에서 한 번만 보이고 로딩은 카드마다 따로 풀린다. 넓은 창은 두 단으로 나눠 각각 스크롤한다 */
export default function WeatherScreen() {
  const location = useWeatherLocation();
  useWeatherScreenTracking(location.status);
  const locationRevision = useWeatherLocationRevision();
  const isCompact = useWindowSizeClass() === 'compact';

  return (
    <>
      <WeatherBackground />
      {match(location)
        .with({ status: 'needsPermission' }, { status: 'denied' }, () => (
          <WeatherScrollView.Status>
            <WeatherLocationPrompt />
          </WeatherScrollView.Status>
        ))
        .with({ status: 'checking' }, { status: 'unavailable' }, { status: 'ready' }, () => (
          <QueryErrorBoundary fallback={WeatherScreen.Error} resetKeys={[locationRevision]}>
            <AdaptivePane
              primary={
                <WeatherScrollView>
                  <ReadableContent style={COLUMN_STYLE}>
                    <Box px={SCREEN_GUTTER}>
                      <WeatherLocationPrompt.SavedLocationNotice />
                    </Box>
                    <Box pt={HERO_TOP} px={HERO_GUTTER}>
                      <Suspense fallback={<WeatherHero.Loading />}>
                        <WeatherHero />
                      </Suspense>
                    </Box>
                    <VStack gap={CARD_GAP} pt={CARDS_TOP} px={SCREEN_GUTTER}>
                      {/* 특보는 대부분 없어서 자리를 미리 잡으면 로딩 뒤 화면이 당겨진다. 자리를 두지 않는다. */}
                      <Suspense fallback={null}>
                        <WeatherAlerts />
                      </Suspense>
                      <QueryErrorBoundary fallback={WeatherBriefing.Error}>
                        <Suspense fallback={<WeatherBriefing.Loading />}>
                          <WeatherBriefing />
                        </Suspense>
                      </QueryErrorBoundary>
                      {/* 분 단위 예보가 없는 지역이 많아 카드 자리를 미리 잡으면 로딩 뒤 화면이 당겨진다. 자리를 두지 않는다. */}
                      <Suspense fallback={null}>
                        <NextHourPrecipitation />
                      </Suspense>
                      <Suspense fallback={<HourlyForecast.Loading />}>
                        <HourlyForecast />
                      </Suspense>
                    </VStack>
                    {isCompact && (
                      <>
                        <Spacing size={CARD_GAP} />
                        <ForecastCards />
                      </>
                    )}
                  </ReadableContent>
                </WeatherScrollView>
              }
              secondary={
                <WeatherScrollView>
                  <ReadableContent style={COLUMN_STYLE}>
                    <ForecastCards />
                  </ReadableContent>
                </WeatherScrollView>
              }
            />
          </QueryErrorBoundary>
        ))
        .exhaustive()}
      <DevOverrideBadge />
    </>
  );
}

function ForecastCards() {
  return (
    <VStack gap={CARD_GAP} px={SCREEN_GUTTER}>
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

WeatherScreen.Error = function ErrorFallback(props: QueryErrorFallbackProps) {
  return (
    <WeatherScrollView.Status>
      <WeatherHero.Error {...props} />
    </WeatherScrollView.Status>
  );
};

/**
 * 날씨 화면이 열릴 때 진입점을, 위치 확인이 처음 끝났을 때 그 결과를 한 번씩 남긴다.
 * 새로고침·포커스 재확인으로 상태가 다시 바뀌어도 같은 화면에서는 더 세지 않는다.
 */
function useWeatherScreenTracking(locationStatus: WeatherLocationStatus['status']): void {
  const [{ entry }] = useRouteParams(weatherEntryParamsSchema);
  const { trackEvent } = useTrack();
  const hasTrackedLocationRef = useRef(false);
  const locationResult = toWeatherLocationRegisteredResult(locationStatus);

  useEffect(() => {
    trackEvent('weather_opened', { entry: toWeatherOpenedEntry(entry) });
  }, [trackEvent, entry]);

  useEffect(() => {
    if (locationResult == null || hasTrackedLocationRef.current) {
      return;
    }
    hasTrackedLocationRef.current = true;
    trackEvent('weather_location_registered', { result: locationResult });
  }, [trackEvent, locationResult]);
}

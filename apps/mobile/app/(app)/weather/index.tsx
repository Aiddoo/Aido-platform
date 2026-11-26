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
import { WeatherLocationNotice } from '@src/features/weather/components/weather-location-notice';
import { WeatherLocationPrompt } from '@src/features/weather/components/weather-location-prompt';
import { WeatherReportGate } from '@src/features/weather/components/weather-report-gate';
import { WeatherScrollView } from '@src/features/weather/components/weather-scroll-view';
import { WeatherSunMoon } from '@src/features/weather/components/weather-sun-moon/weather-sun-moon';
import type { WeatherLocationStatus } from '@src/features/weather/domains/location-reading.model';
import {
  useWeatherEntry,
  useWeatherOpenKey,
} from '@src/features/weather/hooks/use-weather-entry-params';
import { useWeatherLocation } from '@src/features/weather/hooks/use-weather-location';
import {
  usePrefetchForecastCompletions,
  useWeatherLocationRevision,
} from '@src/features/weather/queries/weather.queries';
import {
  toWeatherLocationRegisteredResult,
  toWeatherOpenedEntry,
} from '@src/features/weather/utils/weather-analytics';
import { useTrackView } from '@src/shared/analytics';
import {
  AdaptivePane,
  usePaneSizeClass,
  Box,
  QueryErrorBoundary,
  type QueryErrorFallbackProps,
  ReadableContent,
  Spacing,
  VStack,
} from '@src/shared/ui';
import { Suspense } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { match } from 'ts-pattern';

const SCREEN_GUTTER = 16;
const HERO_GUTTER = 24;
const HERO_TOP = 6;
const CARDS_TOP = 32;
const CARD_GAP = 12;
const DEV_BADGE_BOTTOM = 8;
/** 넓은 pane에서 카드가 과하게 늘어나지 않게 하는 최대 폭 */
const COLUMN_STYLE = { maxWidth: 560 };

/** 위치 확인 중에도 서버 저장 위치로 리포트를 바로 받는다. 모든 카드가 한 요청을 공유해 오류는 경계 하나에서 한 번만 보이고(위치 미등록은 경계 대신 WeatherReportGate가 안내한다) 로딩은 카드마다 따로 풀린다. 넓은 창은 두 단으로 나눠 각각 스크롤한다 */
export default function WeatherScreen() {
  const location = useWeatherLocation();
  useWeatherScreenTracking(location.status);
  const locationRevision = useWeatherLocationRevision();
  const isCompact = usePaneSizeClass() === 'compact';
  const insets = useSafeAreaInsets();

  return (
    <>
      {match(location)
        .with({ status: 'needsPermission' }, ({ request }) => (
          <WeatherLocationPrompt.Ask onContinue={request} />
        ))
        .with({ status: 'denied' }, ({ openSettings }) => (
          <WeatherLocationPrompt.Denied onOpenSettings={openSettings} />
        ))
        .with({ status: 'checking' }, { status: 'unavailable' }, { status: 'ready' }, () => (
          <>
            <WeatherBackground />
            <QueryErrorBoundary fallback={WeatherScreen.Error} resetKeys={[locationRevision]}>
              <WeatherReportGate fallback={WeatherScreen.Error}>
                <AdaptivePane
                  primary={
                    <WeatherScrollView>
                      <ReadableContent style={COLUMN_STYLE}>
                        <Box px={SCREEN_GUTTER}>
                          <WeatherLocationNotice />
                        </Box>

                        <Spacing size={HERO_TOP} />

                        <Box px={HERO_GUTTER}>
                          <WeatherReportGate.Suspense fallback={<WeatherHero.Loading />}>
                            <WeatherHero />
                          </WeatherReportGate.Suspense>
                        </Box>

                        <Spacing size={CARDS_TOP} />

                        <VStack gap={CARD_GAP} px={SCREEN_GUTTER}>
                          {/* 특보는 대부분 없어서 자리를 미리 잡으면 로딩 뒤 화면이 당겨진다. 자리를 두지 않는다. */}
                          <WeatherReportGate.Suspense fallback={null}>
                            <WeatherAlerts />
                          </WeatherReportGate.Suspense>
                          <QueryErrorBoundary fallback={WeatherBriefing.Error}>
                            <Suspense fallback={<WeatherBriefing.Loading />}>
                              <WeatherBriefing />
                            </Suspense>
                          </QueryErrorBoundary>
                          {/* 분 단위 예보가 없는 지역이 많아 카드 자리를 미리 잡으면 로딩 뒤 화면이 당겨진다. 자리를 두지 않는다. */}
                          <WeatherReportGate.Suspense fallback={null}>
                            <NextHourPrecipitation />
                          </WeatherReportGate.Suspense>
                          <WeatherReportGate.Suspense fallback={<HourlyForecast.Loading />}>
                            <HourlyForecast />
                          </WeatherReportGate.Suspense>
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
              </WeatherReportGate>
            </QueryErrorBoundary>
          </>
        ))
        .exhaustive()}
      <DevOverrideBadge
        className="absolute self-center"
        style={{ bottom: insets.bottom + DEV_BADGE_BOTTOM }}
      />
    </>
  );
}

function ForecastCards() {
  // 리포트를 기다리는 블록 안에서 받으면 할 일 점 조회가 리포트 응답 뒤에 나간다
  usePrefetchForecastCompletions();

  return (
    <VStack gap={CARD_GAP} px={SCREEN_GUTTER}>
      <WeatherReportGate.Suspense fallback={<DailyForecast.Loading />}>
        <DailyForecast />
      </WeatherReportGate.Suspense>
      <WeatherReportGate.Suspense fallback={<WeatherDetailGrid.Loading />}>
        <WeatherDetailGrid />
      </WeatherReportGate.Suspense>
      <WeatherReportGate.Suspense fallback={<WeatherSunMoon.Loading />}>
        <WeatherSunMoon />
      </WeatherReportGate.Suspense>
      <WeatherReportGate.Suspense fallback={<WeatherAirQuality.Loading />}>
        <WeatherAirQuality />
      </WeatherReportGate.Suspense>
      <WeatherReportGate.Suspense fallback={<WeatherAttribution.Loading />}>
        <WeatherAttribution background="dark" />
      </WeatherReportGate.Suspense>
    </VStack>
  );
}

/** 리포트 실패 안내를 하늘 장면 가운데에 두고, 당겨서 다시 받을 수 있게 스크롤 안에 그린다 */
WeatherScreen.Error = function ErrorFallback(props: QueryErrorFallbackProps) {
  return (
    <WeatherScrollView.Status>
      <WeatherReportGate.Error {...props} />
    </WeatherScrollView.Status>
  );
};

/** 상태가 다시 바뀌어도 같은 열기에서는 더 세지 않는다. `weather_opened`는 경로 보기(`screen_view`)와 따로 남기는 예외다 */
function useWeatherScreenTracking(locationStatus: WeatherLocationStatus['status']): void {
  const [entry] = useWeatherEntry();
  const [openKey] = useWeatherOpenKey();
  const locationResult = toWeatherLocationRegisteredResult(locationStatus);

  useTrackView('weather_opened', {
    key: openKey,
    params: { entry: toWeatherOpenedEntry(entry) },
  });
  useTrackView(
    'weather_location_registered',
    locationResult == null ? null : { key: openKey, params: { result: locationResult } },
  );
}

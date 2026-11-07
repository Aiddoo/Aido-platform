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
import { useWeatherLocation } from '@src/features/weather/hooks/use-weather-location';
import { useWeatherScreenTracking } from '@src/features/weather/hooks/use-weather-screen-tracking';
import { useWeatherLocationRevision } from '@src/features/weather/queries/weather.queries';
import { useWindowSizeClass } from '@src/shared/hooks/use-window-size-class';
import { AdaptivePane, Box, QueryErrorBoundary, Spacing, VStack } from '@src/shared/ui';
import { type ComponentProps, type PropsWithChildren, Suspense } from 'react';
import { match } from 'ts-pattern';

const SCREEN_GUTTER = 16;
const HERO_GUTTER = 24;
const HERO_TOP = 6;
const CARDS_TOP = 32;
const CARD_GAP = 12;
/** 넓은 pane에서 카드가 과하게 늘어나지 않게 하는 최대 폭 */
const COLUMN_MAX_WIDTH = 560;

/**
 * 위치를 확인하는 동안에도 서버에 저장된 위치로 리포트를 바로 받는다.
 * 모든 카드가 한 요청을 공유하므로 오류는 경계 하나에서 한 번만 보이고, 로딩은 카드마다 따로 풀린다.
 * 좁은 창은 한 단, 넓은 창(iPad·Duo 펼침)은 지금 날씨와 예보·상세를 두 단으로 나누고 각 단을 따로 스크롤한다.
 */
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
          <QueryErrorBoundary fallback={WeatherReportFallback} resetKeys={[locationRevision]}>
            <AdaptivePane
              primary={
                <WeatherScrollView>
                  <WeatherColumn>
                    <Box px={SCREEN_GUTTER}>
                      <WeatherLocationPrompt.SavedLocationNotice />
                    </Box>
                    <Box pt={HERO_TOP} px={HERO_GUTTER}>
                      <Suspense fallback={<WeatherHero.Loading />}>
                        <WeatherHero />
                      </Suspense>
                    </Box>
                    <VStack gap={CARD_GAP} pt={CARDS_TOP} px={SCREEN_GUTTER}>
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
                    {isCompact && (
                      <>
                        <Spacing size={CARD_GAP} />
                        <ForecastCards />
                      </>
                    )}
                  </WeatherColumn>
                </WeatherScrollView>
              }
              secondary={
                <WeatherScrollView>
                  <WeatherColumn>
                    <ForecastCards />
                  </WeatherColumn>
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

/** 좁은 창은 지금 날씨 아래에, 넓은 창은 오른쪽 단에 같은 카드 묶음을 둔다. */
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

function WeatherColumn({ children }: PropsWithChildren) {
  return (
    <Box className="w-full self-center" style={{ maxWidth: COLUMN_MAX_WIDTH }}>
      {children}
    </Box>
  );
}

/** 리포트 오류·위치 안내는 권한 안내와 같은 자리(가로 여백, 세로 가운데)에 둔다. */
function WeatherReportFallback(props: ComponentProps<typeof WeatherHero.Error>) {
  return (
    <WeatherScrollView.Status>
      <WeatherHero.Error {...props} />
    </WeatherScrollView.Status>
  );
}

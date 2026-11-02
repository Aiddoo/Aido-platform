import catAnchorImage from '@assets/images/cat_weather_anchor.png';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { Result, Text, TextSkeleton, type QueryErrorFallbackProps, VStack } from '@src/shared/ui';
import { formatRelativeTimeLabel } from '@src/shared/utils/date';
import { useSuspenseQuery } from '@tanstack/react-query';
import { match, P } from 'ts-pattern';

import { WEATHER_CONDITION_LABEL_KEYS } from '../constants/weather-labels';
import { type DailyForecast, WeatherReportPolicy } from '../domains/weather-report.model';
import {
  isConnectionError,
  isLocationNotRegisteredError,
  isWeatherProviderUnavailableError,
} from '../domains/weather.error';
import { useTemperatureUnit } from '../hooks/use-temperature-unit';
import { useWeatherLocation } from '../hooks/use-weather-location';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../queries/get-weather-report-query-options';
import { formatDegrees } from '../utils/format-degrees';
import { WeatherLocationPrompt } from './weather-location-prompt';
import { WeatherResult } from './weather-result';

/** 세 글자 이상(−12°, 100°F)은 한 줄에 들어가도록 96에서 76까지 줄인다. */
const HERO_MIN_FONT_SCALE = 76 / 96;

export function WeatherHero() {
  const { t } = useTranslation('weather');
  const location = useWeatherLocation();
  const unit = useTemperatureUnit();
  const { data, dataUpdatedAt } = useSuspenseQuery({
    ...useGetWeatherReportQueryOptions(),
    select: WeatherReportSelect.hero,
  });
  const now = new Date(dataUpdatedAt);
  const today = WeatherReportPolicy.todayForecast(data, now);
  const place =
    (location.status === 'ready' ? location.placeName : null) ?? t('hero.currentLocation');
  const temperature = WeatherReportPolicy.displayTemperature(data.current.temperature, unit);
  const condition = t(WEATHER_CONDITION_LABEL_KEYS[data.current.condition]);

  return (
    <VStack align="center" gap={2}>
      <VStack
        align="center"
        accessible
        accessibilityRole="summary"
        accessibilityLabel={t('hero.summary', { place, temperature, condition })}
      >
        <Text size="t1" weight="medium" align="center" tone="white" maxLines={1}>
          {place}
        </Text>
        <Text
          size="display"
          tone="white"
          align="center"
          className="tabular-nums"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={HERO_MIN_FONT_SCALE}
        >
          {formatDegrees(temperature)}
        </Text>
        <Text size="b1" weight="medium" align="center" className="text-white/90">
          {condition}
        </Text>
        {today != null && (
          <Text size="b2" weight="medium" align="center" className="text-white/90">
            {t('hero.highLow', {
              high: formatDegrees(
                WeatherReportPolicy.displayTemperature(today.temperatureMax, unit),
              ),
              low: formatDegrees(
                WeatherReportPolicy.displayTemperature(today.temperatureMin, unit),
              ),
            })}
          </Text>
        )}
      </VStack>
      {today?.restOfDay != null && <WeatherHero.RestOfDay restOfDay={today.restOfDay} />}
      {WeatherReportPolicy.isStale(data, now) && (
        <WeatherHero.StaleNotice fetchedAt={data.fetchedAt} now={now} />
      )}
    </VStack>
  );
}

/** 오늘 남은 시간 예보는 오늘 항목에만 있어 있을 때만 한 줄로 보여 준다. */
WeatherHero.RestOfDay = function RestOfDay({
  restOfDay,
}: {
  restOfDay: NonNullable<DailyForecast['restOfDay']>;
}) {
  const { t } = useTranslation('weather');
  return (
    <Text size="b3" align="center" className="text-white/80">
      {t('hero.restOfDay', {
        condition: t(WEATHER_CONDITION_LABEL_KEYS[restOfDay.condition]),
        chance: restOfDay.precipitationChance,
      })}
    </Text>
  );
};

/** 30분 넘게 갱신되지 않은 데이터는 오류가 아니라 받은 시각만 조용히 알린다. */
WeatherHero.StaleNotice = function StaleNotice({ fetchedAt, now }: { fetchedAt: Date; now: Date }) {
  const { t } = useTranslation('weather');
  const dateFormat = useDateFormatContext();
  return (
    <Text size="b4" align="center" className="text-white/70">
      {t('hero.stale', { relative: formatRelativeTimeLabel(fetchedAt, now, dateFormat) })}
    </Text>
  );
};

WeatherHero.Loading = function Loading() {
  return (
    <VStack align="center" gap={8}>
      <TextSkeleton size="t1" className="w-32 opacity-40" />
      <TextSkeleton size="display" className="w-40 opacity-40" />
      <TextSkeleton size="b1" className="w-20 opacity-40" />
      <TextSkeleton size="b2" className="w-36 opacity-40" />
    </VStack>
  );
};

/**
 * 리포트는 모든 블록이 같은 요청을 쓰므로 실패도 여기 한 곳에서만 보여 준다.
 * 위치를 아직 확인하는 중에 서버에 위치가 없다고(WEATHER_1902) 하면 등록이 끝날 때까지 기다린다.
 */
WeatherHero.Error = function ErrorFallback({ error, reset }: QueryErrorFallbackProps) {
  const { t } = useTranslation(['weather', 'common']);
  const location = useWeatherLocation();
  const retryButton = <Result.Button onPress={reset}>{t('common:actions.retry')}</Result.Button>;

  return match(error)
    .with(P.when(isLocationNotRegisteredError), () =>
      location.status === 'checking' ? (
        <WeatherHero.Loading />
      ) : (
        <WeatherLocationPrompt onRecovered={reset} />
      ),
    )
    .with(P.when(isWeatherProviderUnavailableError), () => (
      <WeatherResult
        image={catAnchorImage}
        title={t('weather:screen.providerUnavailable')}
        description={t('weather:screen.retryLater')}
        button={retryButton}
      />
    ))
    .with(P.when(isConnectionError), () => (
      <WeatherResult
        image={catAnchorImage}
        title={t('weather:screen.offline')}
        description={t('weather:screen.offlineDescription')}
        button={retryButton}
      />
    ))
    .otherwise(() => (
      <WeatherResult
        image={catAnchorImage}
        title={t('weather:screen.loadFailed')}
        description={t('weather:screen.retryLater')}
        button={retryButton}
      />
    ));
};

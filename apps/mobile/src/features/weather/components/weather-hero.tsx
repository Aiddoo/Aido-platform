import catAnchorImage from '@assets/images/cat_weather_anchor.png';
import { useTrack } from '@src/shared/analytics';
import { formatRelativeTimeLabel } from '@src/shared/date/date-labels';
import { toDate, type Instant } from '@src/shared/date/instant';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useFontScaleRatio, useMinimumFontScale } from '@src/shared/hooks/use-minimum-font-scale';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTranslation } from '@src/shared/i18n';
import {
  Box,
  HStack,
  Text,
  TextSkeleton,
  type QueryErrorFallbackProps,
  VStack,
} from '@src/shared/ui';
import { useSuspenseQuery } from '@tanstack/react-query';
import { compact } from 'es-toolkit';
import { useLocales } from 'expo-localization';
import { useEffect } from 'react';
import Animated, { Easing, FadeInDown, ReduceMotion } from 'react-native-reanimated';
import { match, P } from 'ts-pattern';

import { WEATHER_CONDITION_LABEL_KEYS } from '../constants/weather-labels';
import { WeatherReportPolicy } from '../domains/weather-report.model';
import {
  isConnectionError,
  isLocationNotRegisteredError,
  isWeatherProviderUnavailableError,
} from '../domains/weather.error';
import { useTemperatureUnit } from '../hooks/use-temperature-unit';
import { useWeatherLocation } from '../hooks/use-weather-location';
import { useGetWeatherReportQueryOptions, WeatherReportSelect } from '../queries/weather.queries';
import type { PlaceName } from '../schemas/weather-location.schema';
import type { DailyForecastEntry } from '../schemas/weather-report.schema';
import { toWeatherReportFailedCause } from '../utils/analytics/weather-analytics';
import { getForeignCountryName } from '../utils/country-name';
import {
  type TemperatureReading,
  formatTemperature,
  toDisplayTemperature,
  toTemperatureReading,
} from '../utils/weather-temperature';
import { WeatherIcon } from './weather-icon';
import { WeatherLocationPrompt } from './weather-location-prompt';
import { WeatherResult } from './weather-result';

const HERO_TEXT_SHADOW = {
  textShadowColor: 'rgba(0,0,0,0.08)',
  textShadowOffset: { width: 0, height: 1 },
  textShadowRadius: 12,
} as const;
const PLACE_TYPE = { fontSize: 32, lineHeight: 40, letterSpacing: -0.9 };
/** 긴 도시 이름은 72%까지 줄이고, 그래도 넘치면 말줄임한다. */
const PLACE_MINIMUM_FONT_SCALE = 0.72;
const LINE_TYPE = { fontSize: 21, lineHeight: 28, letterSpacing: -0.4 };
/** 시안 V2Spec §6: 히어로 글자는 앱 글자 크기를 따르되 1.2배까지만 키운다. */
const MAX_HERO_SCALE = 1.2;
/** 세 자리(100)는 한 줄에 들어가도록 display(96)에서 76으로 줄인다. */
const LONG_TEMPERATURE_LENGTH = 3;
const LONG_TEMPERATURE_FONT_SIZE = 76;
const TEMPERATURE_LETTER_SPACING_EM = -0.06;
/** display 토큰 크기. 줄 높이·자간을 글자 크기에 맞춰 조일 때만 쓴다. */
const DISPLAY_FONT_SIZE = 96;
/**
 * 숫자 글리프가 줄 상자 안에서 놓이는 높이가 플랫폼마다 달라(iOS는 위로 붙고 Android는 아래로 내려온다),
 * 지명·날씨 줄과 위아래 간격이 같아 보이도록 em 단위로 옮긴다. 76·96 모두 같은 비율로 맞는다.
 */
const TEMPERATURE_OFFSET_EM =
  process.env.EXPO_OS === 'ios'
    ? { top: 0.06, bottomTrim: 0.14 }
    : { top: -0.05, bottomTrim: 0.03 };
/**
 * 영하 기호는 숫자의 0.52배 크기로 숫자 세로 가운데에, °는 0.42배 크기로 숫자 위쪽에 붙인다.
 * 글리프가 줄 상자 안에 놓이는 높이가 플랫폼마다 달라 위치를 em 단위로 맞춘다.
 */
const SIGN = {
  scale: 0.52,
  top: process.env.EXPO_OS === 'ios' ? 0.27 : 0.33,
} as const;
/** 숫자가 가운데에 오도록 양쪽에 같은 폭의 기호 자리를 둔다. */
const SYMBOL_SLOT_EM = 0.32;
const DEGREE = {
  scale: 0.42,
  top: process.env.EXPO_OS === 'ios' ? 0.1 : 0.18,
} as const;
const HERO_ENTERING = FadeInDown.duration(600)
  .easing(Easing.bezier(0.2, 0.8, 0.2, 1).factory())
  .withInitialValues({ opacity: 0, transform: [{ translateY: 10 }] })
  .reduceMotion(ReduceMotion.System);

function useHeroScale() {
  return Math.min(useFontScaleRatio(), MAX_HERO_SCALE);
}

function scaleType(type: typeof PLACE_TYPE, scale: number) {
  return {
    ...HERO_TEXT_SHADOW,
    fontSize: type.fontSize * scale,
    lineHeight: type.lineHeight * scale,
    letterSpacing: type.letterSpacing * scale,
  };
}

export function WeatherHero() {
  const { t } = useTranslation('weather');
  const location = useWeatherLocation();
  const scale = useHeroScale();
  const placeStyle = scaleType(PLACE_TYPE, scale);
  const lineStyle = scaleType(LINE_TYPE, scale);
  const unit = useTemperatureUnit();
  const { data } = useSuspenseQuery({
    ...useGetWeatherReportQueryOptions(),
    select: WeatherReportSelect.hero,
  });
  const now = useMinuteNow();
  const today = WeatherReportPolicy.findTodayForecast(data, now);
  const place = location.status === 'ready' ? location.place : null;
  const countryCode = location.status === 'ready' ? location.countryCode : null;
  const title = place?.city ?? t('hero.currentLocation');
  const reading = toTemperatureReading(toDisplayTemperature(data.current.temperature, unit));
  const condition = t(WEATHER_CONDITION_LABEL_KEYS[data.current.condition]);
  const temperature = reading.isBelowZero
    ? t('hero.temperatureBelowZero', { count: reading.magnitude })
    : t('hero.temperature', { count: reading.magnitude });

  return (
    <Animated.View entering={HERO_ENTERING}>
      <VStack align="center">
        <VStack
          align="center"
          className="w-full"
          accessible
          accessibilityRole="summary"
          accessibilityLabel={t('hero.summary', {
            place: place == null ? title : compact([place.city, place.district]).join(' '),
            temperature,
            condition,
          })}
        >
          {place != null && (
            <WeatherHero.LocationLabel countryCode={countryCode} district={place.district} />
          )}
          <Text
            weight="medium"
            align="center"
            tone="onSky"
            maxLines={1}
            adjustsFontSizeToFit
            minimumFontScale={PLACE_MINIMUM_FONT_SCALE}
            className="mt-0.5 max-w-full"
            style={placeStyle}
          >
            {title}
          </Text>
          <WeatherHero.Temperature reading={reading} />
          <Text
            weight="medium"
            align="center"
            className="mt-0.5 text-on-sky/[0.92]"
            style={lineStyle}
          >
            {condition}
          </Text>
          {today != null && (
            <Text weight="medium" align="center" tone="onSky" style={lineStyle}>
              {t('hero.highLow', {
                high: formatTemperature(today.temperatureMax, unit),
                low: formatTemperature(today.temperatureMin, unit),
              })}
            </Text>
          )}
        </VStack>
        {today?.restOfDay != null && <WeatherHero.RestOfDay restOfDay={today.restOfDay} />}
        {WeatherReportPolicy.isReportStale(data, now) && (
          <WeatherHero.StaleNotice fetchedAt={data.fetchedAt} now={now} />
        )}
      </VStack>
    </Animated.View>
  );
}

/**
 * 도시 위의 작은 위치 표시. 기기 위치로 받은 지명일 때만 보이고, 기기 지역과 다른 나라면 나라 이름을,
 * 동네를 알면 동네 이름을 붙인다.
 */
WeatherHero.LocationLabel = function LocationLabel({
  countryCode,
  district,
}: {
  countryCode: string | null;
  district: PlaceName['district'];
}) {
  const { t, i18n } = useTranslation('weather');
  const [deviceLocale] = useLocales();
  const minimumFontScale = useMinimumFontScale('b4');
  const country = getForeignCountryName(
    { countryCode },
    deviceLocale?.regionCode ?? null,
    i18n.language,
  );
  const area = compact([country, district]);

  return (
    <HStack align="center" gap={5}>
      <WeatherIcon.Card glyph="location" size={11} colorClassName="text-on-sky/[0.78]" />
      <Text
        size="b4"
        weight="medium"
        maxLines={1}
        adjustsFontSizeToFit
        minimumFontScale={minimumFontScale}
        className="text-on-sky/[0.78]"
        style={HERO_TEXT_SHADOW}
      >
        {area.length === 0
          ? t('hero.currentLocation')
          : t('hero.currentLocationIn', { area: area.join(' · ') })}
      </Text>
    </HStack>
  );
};

/**
 * 숫자 양쪽에 같은 폭의 기호 자리를 두어 숫자는 늘 가운데에 있고, 왼쪽 자리에 영하 기호, 오른쪽 자리에 °를 둔다.
 * 크기는 display 토큰을 쓰고(앱 글자 크기와 무관), 세 자리만 76으로 줄인다.
 */
WeatherHero.Temperature = function Temperature({ reading }: { reading: TemperatureReading }) {
  const digits = String(reading.magnitude);
  const isLong = digits.length >= LONG_TEMPERATURE_LENGTH;
  const fontSize = isLong ? LONG_TEMPERATURE_FONT_SIZE : DISPLAY_FONT_SIZE;
  const style = {
    ...HERO_TEXT_SHADOW,
    ...(isLong ? { fontSize: LONG_TEMPERATURE_FONT_SIZE } : null),
    lineHeight: fontSize,
  };
  const slotWidth = fontSize * SYMBOL_SLOT_EM;

  return (
    <HStack
      align="start"
      style={{
        marginTop: fontSize * TEMPERATURE_OFFSET_EM.top,
        marginBottom: -fontSize * TEMPERATURE_OFFSET_EM.bottomTrim,
      }}
    >
      <Box style={{ width: slotWidth }} className="items-end">
        {reading.isBelowZero && (
          <WeatherHero.TemperatureSymbol fontSize={fontSize} symbol={SIGN} value="−" />
        )}
      </Box>
      <Text
        size="display"
        tone="onSky"
        weight="normal"
        style={{ ...style, letterSpacing: fontSize * TEMPERATURE_LETTER_SPACING_EM }}
      >
        {digits}
      </Text>
      <Box style={{ width: slotWidth }} className="items-start">
        <WeatherHero.TemperatureSymbol fontSize={fontSize} symbol={DEGREE} value="°" />
      </Box>
    </HStack>
  );
};

/** 큰 기온 옆의 작은 영하 기호·도 기호. 숫자 크기에 비례한 크기와 높이로 놓인다. */
WeatherHero.TemperatureSymbol = function TemperatureSymbol({
  fontSize,
  symbol,
  value,
}: {
  fontSize: number;
  symbol: { scale: number; top: number };
  value: string;
}) {
  return (
    <Text
      tone="onSky"
      weight="normal"
      style={{
        ...HERO_TEXT_SHADOW,
        marginTop: fontSize * symbol.top,
        fontSize: fontSize * symbol.scale,
        lineHeight: fontSize * symbol.scale,
        letterSpacing: 0,
      }}
    >
      {value}
    </Text>
  );
};

/** 오늘 남은 시간 예보는 오늘 항목에만 있어 있을 때만 한 줄로 보여 준다. */
WeatherHero.RestOfDay = function RestOfDay({
  restOfDay,
}: {
  restOfDay: NonNullable<DailyForecastEntry['restOfDay']>;
}) {
  const { t } = useTranslation('weather');
  return (
    <Text size="b4" align="center" className="mt-1 text-on-sky/[0.78]" style={HERO_TEXT_SHADOW}>
      {t('hero.restOfDay', {
        condition: t(WEATHER_CONDITION_LABEL_KEYS[restOfDay.condition]),
        chance: restOfDay.precipitationChance,
      })}
    </Text>
  );
};

/** 30분 넘게 갱신되지 않은 데이터는 오류가 아니라 받은 시각만 조용히 알린다. */
WeatherHero.StaleNotice = function StaleNotice({
  fetchedAt,
  now,
}: {
  fetchedAt: Instant;
  now: Date;
}) {
  const { t } = useTranslation('weather');
  const dateFormat = useDateFormatContext();
  return (
    <Text size="b4" align="center" className="mt-1 text-on-sky/[0.78]" style={HERO_TEXT_SHADOW}>
      {t('hero.stale', { relative: formatRelativeTimeLabel(toDate(fetchedAt), now, dateFormat) })}
    </Text>
  );
};

WeatherHero.Loading = function Loading() {
  return (
    <VStack align="center" gap={4}>
      <TextSkeleton size="b4" className="w-16 opacity-40" />
      <TextSkeleton size="h1" className="w-32 opacity-40" />
      <TextSkeleton size="display" className="w-32 opacity-40" />
      <TextSkeleton size="t3" className="w-20 opacity-40" />
      <TextSkeleton size="t3" className="w-36 opacity-40" />
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
  const { trackEvent } = useTrack();
  const cause = toWeatherReportFailedCause(error);
  // 위치 등록을 기다리는 동안은 실패가 아니라 로딩으로 보인다
  const isWaitingForLocation = cause === 'no_location' && location.status === 'checking';

  useEffect(() => {
    if (isWaitingForLocation) {
      return;
    }
    trackEvent('weather_report_failed', { cause });
  }, [trackEvent, cause, isWaitingForLocation]);

  const retryButton = (
    <WeatherResult.Action tone="light" onPress={reset}>
      {t('common:actions.retry')}
    </WeatherResult.Action>
  );

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
      >
        {retryButton}
      </WeatherResult>
    ))
    .with(P.when(isConnectionError), () => (
      <WeatherResult
        image={catAnchorImage}
        title={t('weather:screen.offline')}
        description={t('weather:screen.offlineDescription')}
      >
        {retryButton}
      </WeatherResult>
    ))
    .otherwise(() => (
      <WeatherResult
        image={catAnchorImage}
        title={t('weather:screen.loadFailed')}
        description={t('weather:screen.retryLater')}
      >
        {retryButton}
      </WeatherResult>
    ));
};

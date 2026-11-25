import type { WeatherPressureTrend } from '@aido/api/vocabulary';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { formatInstantHour } from '@src/shared/date/format/date-format';
import { type Instant } from '@src/shared/date/instant';
import { useLayoutSize } from '@src/shared/hooks/use-layout-size';
import { useMinimumFontScale } from '@src/shared/hooks/use-minimum-font-scale';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTranslation } from '@src/shared/i18n';
import { useFontScale } from '@src/shared/providers/font-scale-provider';
import { Box, Grid, GridItem, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { formatDecimal } from '@src/shared/utils/number-format';
import { useSuspenseQueries } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import type { ReactNode } from 'react';
import type { LayoutChangeEvent } from 'react-native';
import { match } from 'ts-pattern';

import { UV_METER_COLORS } from '../../constants/weather-colors.constants';
import {
  type CloudCoverLevel,
  type CompassDirection,
  type CurrentWeather,
  CurrentWeatherPolicy,
  type FeelsLikeComparison,
  type UvLevel,
  type VisibilityLevel,
  type WindLevel,
} from '../../domains/current-weather.model';
import { useLocationDateFormat } from '../../hooks/use-location-date-format';
import { useTemperatureUnit } from '../../hooks/use-temperature-unit';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../../queries/weather.queries';
import { toUvMeterPosition } from '../../utils/weather-bar.geometry';
import { toCompassDial, toPressureGauge } from '../../utils/weather-dial.geometry';
import { getCompassShortLabelKey } from '../../utils/weather-labels.view-model';
import {
  formatDegrees,
  formatTemperature,
  toDisplayTemperature,
} from '../../utils/weather-temperature.view-model';
import { toVisibilityKilometers } from '../../utils/weather-visibility.view-model';
import { WeatherCard } from '../weather-card';
import { WeatherIcon, type WeatherCardGlyph } from '../weather-icon';
import { WeatherMeter } from '../weather-meter';
import { WeatherCompass, WeatherPressureGauge } from './weather-dial';

const UV_LEVEL_LABEL_KEYS = {
  low: 'uvLevel.low',
  moderate: 'uvLevel.moderate',
  high: 'uvLevel.high',
  veryHigh: 'uvLevel.veryHigh',
  extreme: 'uvLevel.extreme',
} as const satisfies Record<UvLevel, string>;

const PRESSURE_TREND_LABEL_KEYS = {
  RISING: 'pressureTrend.rising',
  FALLING: 'pressureTrend.falling',
  STEADY: 'pressureTrend.steady',
} as const satisfies Record<WeatherPressureTrend, string>;

const COMPASS_LABEL_KEYS = {
  n: 'compass.n',
  ne: 'compass.ne',
  e: 'compass.e',
  se: 'compass.se',
  s: 'compass.s',
  sw: 'compass.sw',
  w: 'compass.w',
  nw: 'compass.nw',
} as const satisfies Record<CompassDirection, string>;

const FEELS_LIKE_LABEL_KEYS = {
  colder: 'details.feelsColder',
  similar: 'details.feelsSimilar',
  warmer: 'details.feelsWarmer',
} as const satisfies Record<FeelsLikeComparison, string>;

const FEELS_LIKE_NOTE_KEYS = {
  colder: 'details.feelsColderNote',
  similar: 'details.feelsSimilarNote',
  warmer: 'details.feelsWarmerNote',
} as const satisfies Record<FeelsLikeComparison, string>;

const VISIBILITY_LEVEL_LABEL_KEYS = {
  clear: 'details.visibilityClear',
  moderate: 'details.visibilityModerate',
  poor: 'details.visibilityPoor',
} as const satisfies Record<VisibilityLevel, string>;

const CLOUD_COVER_LEVEL_LABEL_KEYS = {
  overcast: 'details.cloudOvercast',
  mostlyCloudy: 'details.cloudMostlyCloudy',
  mostlyClear: 'details.cloudMostlyClear',
} as const satisfies Record<CloudCoverLevel, string>;

const WIND_LEVEL_NOTE_KEYS = {
  calm: 'details.windCalm',
  breeze: 'details.windBreeze',
  strong: 'details.windStrong',
} as const satisfies Record<WindLevel, string>;

type CloudCoverNote = 'overcast' | 'brokenDay' | 'brokenNight' | 'clearDay' | 'clearNight';
const CLOUD_COVER_NOTE_KEYS = {
  overcast: 'details.cloudOvercastNote',
  brokenDay: 'details.cloudBrokenDayNote',
  brokenNight: 'details.cloudBrokenNightNote',
  clearDay: 'details.cloudClearDayNote',
  clearNight: 'details.cloudClearNightNote',
} as const satisfies Record<CloudCoverNote, string>;

const LOADING_TILE_COUNT = 8;
/** 태블릿·펼친 폴더블처럼 부모 폭이 넓으면 타일을 네 칸으로 펼쳐 시안 비율을 지킨다. */
const FOUR_COLUMN_MIN_WIDTH = 760;
const TILE_GRID_GAP = 12;
const TILE_PADDING = 14;
const TILE_BORDER = 1;
/** 제목 줄(leading 18) 높이. 본문 최소 높이에서 뺀다. */
const TILE_HEADER_HEIGHT = 18;
/** 한 칸으로 쌓는 큰 글자에서는 정사각형 대신 이 높이를 최소로 맞춘다. */
const LARGE_TEXT_TILE_HEIGHT = 200;
const DIAL_MAX_SIZE = 140;
const VALUE_FONT_SIZE = 32;

/** 구름 단계에 낮밤을 더해 안내 문구 키를 고른다. 흐림은 낮밤이 같다. */
function getCloudCoverNoteKey(current: CurrentWeather) {
  const { isDaylight } = current;
  return match(CurrentWeatherPolicy.getCloudCoverLevel(current))
    .with('overcast', () => CLOUD_COVER_NOTE_KEYS.overcast)
    .with('mostlyCloudy', () =>
      isDaylight ? CLOUD_COVER_NOTE_KEYS.brokenDay : CLOUD_COVER_NOTE_KEYS.brokenNight,
    )
    .with('mostlyClear', () =>
      isDaylight ? CLOUD_COVER_NOTE_KEYS.clearDay : CLOUD_COVER_NOTE_KEYS.clearNight,
    )
    .exhaustive();
}

export function WeatherDetailGrid() {
  const { t } = useTranslation('weather');
  const unit = useTemperatureUnit();
  const { columns, bodyMinHeight, onLayout } = useTileLayout();
  // select가 지금 시각으로 남은 시간을 고르므로 조회보다 먼저 읽는다
  const now = useMinuteNow();
  const [{ data: weather }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.details(now) },
      useGetPreferenceQueryOptions(),
    ],
  });
  const dateFormat = useLocationDateFormat(weather.timezone);

  const formatHour = (date: Instant) => formatInstantHour(date, preference.timeFormat, dateFormat);
  const formatSpeed = (metersPerSecond: number) =>
    formatDecimal(metersPerSecond, dateFormat.locale);
  const { current, nextDayPrecipitation } = weather;
  const feelsLike = CurrentWeatherPolicy.getFeelsLikeComparison(current);
  const feelsDifference = Math.abs(
    toDisplayTemperature(current.apparentTemperature, unit) -
      toDisplayTemperature(current.temperature, unit),
  );
  const sunscreen = weather.sunscreenWindow;
  const direction = CurrentWeatherPolicy.findCompassDirection(current);
  const windSpeed = formatSpeed(current.windSpeed);
  const pressure = String(Math.round(current.pressure));
  const visibilityLevel = CurrentWeatherPolicy.getVisibilityLevel(current);
  const cloudCoverNoteKey = getCloudCoverNoteKey(current);

  return (
    <Box>
      <Box onLayout={onLayout} />
      <Grid columns={columns} gap={TILE_GRID_GAP}>
        <GridItem>
          <WeatherTextTile
            minHeight={bodyMinHeight}
            icon="thermo"
            title={t('details.feelsLike')}
            value={formatTemperature(current.apparentTemperature, unit)}
            subtitle={t(FEELS_LIKE_LABEL_KEYS[feelsLike])}
            note={t(FEELS_LIKE_NOTE_KEYS[feelsLike], {
              difference: formatDegrees(feelsDifference),
            })}
          />
        </GridItem>
        <GridItem>
          <WeatherTextTile
            minHeight={bodyMinHeight}
            icon="uv"
            title={t('details.uv')}
            value={String(current.uvIndex)}
            subtitle={t(UV_LEVEL_LABEL_KEYS[CurrentWeatherPolicy.getUvLevel(current)])}
            note={
              sunscreen == null
                ? t('details.uvLowToday')
                : t('details.uvSunscreen', {
                    start: formatHour(sunscreen.startsAt),
                    end: formatHour(sunscreen.endsAt),
                  })
            }
          >
            <Box className="mt-3">
              <WeatherMeter
                colors={UV_METER_COLORS}
                position={toUvMeterPosition(current.uvIndex)}
              />
            </Box>
          </WeatherTextTile>
        </GridItem>
        <GridItem>
          <WeatherDialTile
            minHeight={bodyMinHeight}
            icon="wind"
            title={t('details.wind')}
            accessibilityValue={
              direction == null
                ? t('details.windSpeedValue', { speed: windSpeed })
                : t('details.windSummary', {
                    speed: windSpeed,
                    direction: t(COMPASS_LABEL_KEYS[direction]),
                  })
            }
            note={
              current.windGust == null
                ? t(WIND_LEVEL_NOTE_KEYS[CurrentWeatherPolicy.getWindLevel(current)])
                : t('details.windGust', { speed: formatSpeed(current.windGust) })
            }
          >
            {(size) => (
              <WeatherCompass
                size={size}
                dial={toCompassDial(current.windDirection)}
                value={windSpeed}
                unit={
                  direction == null
                    ? t('details.windUnit')
                    : t('details.windUnitWithDirection', {
                        direction: t(getCompassShortLabelKey(direction)),
                      })
                }
              />
            )}
          </WeatherDialTile>
        </GridItem>
        {nextDayPrecipitation != null && (
          <GridItem>
            <WeatherTextTile
              minHeight={bodyMinHeight}
              icon="drop"
              title={t('details.precipitation')}
              value={t('details.millimeterValue', { value: nextDayPrecipitation })}
              subtitle={t('details.nextDay')}
              note={
                current.precipitationIntensity > 0
                  ? t('details.precipitatingNow', {
                      value: formatDecimal(current.precipitationIntensity, dateFormat.locale),
                    })
                  : t('details.dryNow')
              }
            />
          </GridItem>
        )}
        <GridItem>
          <WeatherTextTile
            minHeight={bodyMinHeight}
            icon="humidity"
            title={t('details.humidity')}
            value={t('details.percentValue', { value: current.humidity })}
            subtitle={t('details.dewPoint', {
              value: formatTemperature(current.dewPoint, unit),
            })}
            note={
              CurrentWeatherPolicy.isMuggy(current) ? t('details.muggy') : t('details.comfortable')
            }
          />
        </GridItem>
        <GridItem>
          <WeatherTextTile
            minHeight={bodyMinHeight}
            icon="eye"
            title={t('details.visibility')}
            value={t('details.kilometerValue', {
              value: toVisibilityKilometers(current.visibility),
            })}
            subtitle={t(VISIBILITY_LEVEL_LABEL_KEYS[visibilityLevel])}
            note={
              visibilityLevel === 'poor'
                ? t('details.visibilityDriveCarefully')
                : t('details.visibilityFar')
            }
          />
        </GridItem>
        <GridItem>
          <WeatherDialTile
            minHeight={bodyMinHeight}
            icon="gauge"
            title={t('details.pressure')}
            accessibilityValue={t('details.pressureValue', { value: pressure })}
            note={t(PRESSURE_TREND_LABEL_KEYS[current.pressureTrend])}
          >
            {(size) => (
              <WeatherPressureGauge
                size={size}
                gauge={toPressureGauge(current.pressure)}
                value={pressure}
                unit={t('details.pressureUnit')}
                lowLabel={t('details.pressureLow')}
                highLabel={t('details.pressureHigh')}
              />
            )}
          </WeatherDialTile>
        </GridItem>
        <GridItem>
          <WeatherTextTile
            minHeight={bodyMinHeight}
            icon="cloud"
            title={t('details.cloudCover')}
            value={t('details.percentValue', { value: current.cloudCover })}
            subtitle={t(
              CLOUD_COVER_LEVEL_LABEL_KEYS[CurrentWeatherPolicy.getCloudCoverLevel(current)],
            )}
            note={t(cloudCoverNoteKey)}
          />
        </GridItem>
      </Grid>
    </Box>
  );
}

WeatherDetailGrid.Loading = function Loading() {
  const { columns, bodyMinHeight, onLayout } = useTileLayout();

  return (
    <Box>
      <Box onLayout={onLayout} />
      <Grid columns={columns} gap={TILE_GRID_GAP}>
        {range(LOADING_TILE_COUNT).map((index) => (
          <GridItem key={index}>
            <WeatherTile.Loading minHeight={bodyMinHeight} />
          </GridItem>
        ))}
      </Grid>
    </Box>
  );
};

interface WeatherTileProps {
  icon: WeatherCardGlyph;
  title: string;
  minHeight: number;
  accessibilityLabel: string;
  note: string;
  children: ReactNode;
}

/** 모든 타일이 같은 뼈대(제목 → 본문 → 바닥에 붙은 문구)를 갖도록 높이와 순서를 고정한다. */
function WeatherTile({
  icon,
  title,
  minHeight,
  accessibilityLabel,
  note,
  children,
}: WeatherTileProps) {
  const noteMinScale = useMinimumFontScale('b4');
  return (
    <WeatherCard title={title} icon={<WeatherIcon.Card glyph={icon} />} density="tile">
      <VStack
        className="grow"
        style={{ minHeight: Math.max(0, minHeight - TILE_HEADER_HEIGHT) }}
        accessible
        accessibilityLabel={accessibilityLabel}
      >
        {children}
        <Text
          size="b4"
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={noteMinScale}
          className="mt-2 leading-[18px] text-on-sky/[0.78]"
        >
          {note}
        </Text>
      </VStack>
    </WeatherCard>
  );
}

interface WeatherTextTileProps {
  icon: WeatherCardGlyph;
  title: string;
  minHeight: number;
  value: string;
  subtitle: string;
  note: string;
  children?: ReactNode;
}

function WeatherTextTile({
  icon,
  title,
  minHeight,
  value,
  subtitle,
  note,
  children,
}: WeatherTextTileProps) {
  const { t } = useTranslation('weather');
  const valueMinScale = useMinimumFontScale(VALUE_FONT_SIZE);
  const subMinScale = useMinimumFontScale('b1');

  return (
    <WeatherTile
      icon={icon}
      title={title}
      minHeight={minHeight}
      note={note}
      accessibilityLabel={t('details.tile', {
        title,
        value: t('details.tileValue', { value, sub: subtitle }),
        note,
      })}
    >
      <VStack className="mt-1.5 flex-1">
        <Text
          tone="onSky"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={valueMinScale}
          className="font-normal text-[32px] leading-[38px] tracking-[-1px] tabular-nums"
        >
          {value}
        </Text>
        <Text
          size="b1"
          weight="semibold"
          tone="onSky"
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={subMinScale}
          className="leading-[23px]"
        >
          {subtitle}
        </Text>
        {children}
      </VStack>
    </WeatherTile>
  );
}

interface WeatherDialTileProps {
  icon: WeatherCardGlyph;
  title: string;
  minHeight: number;
  accessibilityValue: string;
  note: string;
  /** 본문 칸 크기에 맞춘 다이얼 한 변(dp)을 받아 그린다. */
  children: (size: number) => ReactNode;
}

function WeatherDialTile({
  icon,
  title,
  minHeight,
  accessibilityValue,
  note,
  children,
}: WeatherDialTileProps) {
  const { t } = useTranslation('weather');
  const [box, handleLayout] = useLayoutSize();
  const size = box == null ? 0 : Math.floor(Math.min(box.width, box.height, DIAL_MAX_SIZE));

  return (
    <WeatherTile
      icon={icon}
      title={title}
      minHeight={minHeight}
      note={note}
      accessibilityLabel={t('details.tile', { title, value: accessibilityValue, note })}
    >
      <Box className="mt-1.5 flex-1 items-center justify-center" onLayout={handleLayout}>
        {size > 0 && <Box className="absolute">{children(size)}</Box>}
      </Box>
    </WeatherTile>
  );
}

WeatherTile.Loading = function Loading({ minHeight }: Pick<WeatherTileProps, 'minHeight'>) {
  return (
    <WeatherCard density="tile">
      <VStack gap={8} style={{ minHeight }}>
        <TextSkeleton size="b4" className="w-16 opacity-40" />
        <TextSkeleton size="t1" className="w-12 opacity-40" />
      </VStack>
    </WeatherCard>
  );
};

interface TileLayout {
  columns: number;
  /** 타일 안쪽(여백·테두리 제외) 최소 높이. 두 칸 이상이면 타일이 정사각형이 되는 값이다. */
  bodyMinHeight: number;
  /** 높이 0인 폭 재기 줄에 단다. 격자에 달면 타일 높이가 정해질 때 한 번 더 그린다 */
  onLayout: (event: LayoutChangeEvent) => void;
}

/** 애플 날씨처럼 모든 타일을 같은 크기로 맞춘다. 칸 폭은 부모 폭과 열 수로 구한다. */
function useTileLayout(): TileLayout {
  // 앱 글자 크기가 가장 클 때는 두 칸에 값이 잘리므로 한 칸으로 쌓는다
  const isLargeText = useFontScale().fontScale === 'xlarge';
  const [size, handleLayout] = useLayoutSize();
  const width = size?.width ?? 0;
  const wideColumns = width >= FOUR_COLUMN_MIN_WIDTH ? 4 : 2;
  const columns = isLargeText ? wideColumns / 2 : wideColumns;
  const tileSide = (width - TILE_GRID_GAP * (columns - 1)) / columns;
  const tileHeight = isLargeText ? LARGE_TEXT_TILE_HEIGHT : tileSide;
  return {
    columns,
    bodyMinHeight: Math.max(0, tileHeight - TILE_PADDING * 2 - TILE_BORDER),
    onLayout: handleLayout,
  };
}

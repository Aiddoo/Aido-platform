import { useGetPreferenceQueryOptions } from '@src/features/preference/queries/get-preference-query-options';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { useTranslation } from '@src/shared/i18n';
import { Grid, GridItem, Text, TextSkeleton, VStack } from '@src/shared/ui';
import { WeatherSunriseIcon, WeatherSunsetIcon } from '@src/shared/ui/icon';
import { formatClockTime } from '@src/shared/utils/date-format';
import { useSuspenseQueries } from '@tanstack/react-query';
import { compact } from 'es-toolkit';
import { times } from 'es-toolkit/compat';
import type { ReactNode } from 'react';
import { useWindowDimensions } from 'react-native';
import { match } from 'ts-pattern';

import {
  AIR_GRADE_LABEL_KEYS,
  AIR_QUALITY_SOURCE_LABEL_KEYS,
  COMPASS_LABEL_KEYS,
  FEELS_LIKE_LABEL_KEYS,
  MOON_PHASE_LABEL_KEYS,
  PRESSURE_TREND_LABEL_KEYS,
  UV_LEVEL_LABEL_KEYS,
} from '../constants/weather-labels';
import { type SunEvents, WeatherReportPolicy } from '../domains/weather-report.model';
import { useTemperatureUnit } from '../hooks/use-temperature-unit';
import {
  useGetWeatherReportQueryOptions,
  WeatherReportSelect,
} from '../queries/get-weather-report-query-options';
import { formatDegrees } from '../utils/format-degrees';
import { WeatherCard } from './weather-card';

/** 큰 글자에서는 두 칸에 값이 잘리므로 한 칸으로 쌓는다. */
const SINGLE_COLUMN_FONT_SCALE = 1.35;
const METERS_PER_KILOMETER = 1000;
const GRID_GAP = 12;
const LOADING_TILE_COUNT = 6;

export function WeatherDetailGrid() {
  const { t } = useTranslation('weather');
  const { fontScale } = useWindowDimensions();
  const unit = useTemperatureUnit();
  const [{ data, dataUpdatedAt }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.details },
      useGetPreferenceQueryOptions(),
    ],
  });
  const dateFormat = { ...useDateFormatContext(), timeZone: data.location.timezone };
  const formatTime = (date: Date) => formatClockTime(date, preference.timeFormat, dateFormat);
  const { current, airQuality } = data;
  const today = WeatherReportPolicy.todayForecast(data, new Date(dataUpdatedAt));
  const direction = WeatherReportPolicy.compassDirection(current.windDirection);
  const airQualitySummary = WeatherReportPolicy.airQualitySummary(airQuality);
  const columns = fontScale >= SINGLE_COLUMN_FONT_SCALE ? 1 : 2;

  return (
    <Grid columns={columns} gap={GRID_GAP}>
      <GridItem>
        <WeatherDetailGrid.Tile
          title={t('details.feelsLike')}
          value={formatDegrees(
            WeatherReportPolicy.displayTemperature(current.apparentTemperature, unit),
          )}
          note={t(FEELS_LIKE_LABEL_KEYS[WeatherReportPolicy.feelsLike(current)])}
        />
      </GridItem>
      <GridItem>
        <WeatherDetailGrid.Tile
          title={t('details.uv')}
          value={String(current.uvIndex)}
          note={t(UV_LEVEL_LABEL_KEYS[WeatherReportPolicy.uvLevel(current.uvIndex)])}
        />
      </GridItem>
      <GridItem>
        <WeatherDetailGrid.Tile
          title={t('details.wind')}
          value={t('details.windValue', { speed: Math.round(current.windSpeed) })}
          note={compact([
            direction == null
              ? null
              : t('details.windDirection', { direction: t(COMPASS_LABEL_KEYS[direction]) }),
            current.windGust == null
              ? null
              : t('details.windGust', { speed: Math.round(current.windGust) }),
          ]).join('\n')}
        />
      </GridItem>
      <GridItem>
        <WeatherDetailGrid.Tile
          title={t('details.humidity')}
          value={t('details.percentValue', { value: current.humidity })}
          note={t('details.dewPoint', {
            value: formatDegrees(WeatherReportPolicy.displayTemperature(current.dewPoint, unit)),
          })}
        />
      </GridItem>
      <GridItem>
        <WeatherDetailGrid.Tile
          title={t('details.visibility')}
          value={t('details.kilometerValue', {
            value: Math.round(current.visibility / METERS_PER_KILOMETER),
          })}
        />
      </GridItem>
      <GridItem>
        <WeatherDetailGrid.Tile
          title={t('details.pressure')}
          value={t('details.pressureValue', { value: Math.round(current.pressure) })}
          note={t(PRESSURE_TREND_LABEL_KEYS[current.pressureTrend])}
        />
      </GridItem>
      {today != null && (
        <GridItem>
          <WeatherDetailGrid.SunTile
            events={WeatherReportPolicy.sunEvents(today, current.isDaylight)}
            formatTime={formatTime}
          />
        </GridItem>
      )}
      {today != null && (
        <GridItem>
          <WeatherDetailGrid.Tile
            title={t('details.moon')}
            value={t(MOON_PHASE_LABEL_KEYS[today.moonPhase])}
            note={compact([
              today.moonrise == null
                ? null
                : t('details.moonrise', { time: formatTime(today.moonrise) }),
              today.moonset == null
                ? null
                : t('details.moonset', { time: formatTime(today.moonset) }),
            ]).join('\n')}
          />
        </GridItem>
      )}
      {airQualitySummary != null && (
        <GridItem colSpan={columns}>
          <WeatherDetailGrid.Tile
            title={t('details.airQuality')}
            value={
              airQualitySummary.grade == null
                ? t('details.noValue')
                : t(AIR_GRADE_LABEL_KEYS[airQualitySummary.grade])
            }
            note={[
              t('details.pm', {
                pm10: airQualitySummary.pm10 ?? t('details.noValue'),
                pm25: airQualitySummary.pm25 ?? t('details.noValue'),
              }),
              t(AIR_QUALITY_SOURCE_LABEL_KEYS[airQualitySummary.source]),
            ].join('\n')}
          />
        </GridItem>
      )}
    </Grid>
  );
}

interface WeatherDetailTileProps {
  title: string;
  value: string;
  note?: string;
  icon?: ReactNode;
}

/** 빈 보조 문구("")는 줄을 만들지 않는다. 값이 없는 항목은 호출부가 "—"로 채운다. */
WeatherDetailGrid.Tile = function Tile({ title, value, note, icon }: WeatherDetailTileProps) {
  const { t } = useTranslation('weather');
  const hasNote = note != null && note !== '';

  return (
    <WeatherCard title={title} icon={icon}>
      <VStack
        gap={4}
        className="min-h-16"
        accessible
        accessibilityLabel={t('details.tile', { title, value, note: hasNote ? note : '' })}
      >
        <Text size="t2" weight="medium" tone="white" maxLines={2}>
          {value}
        </Text>
        {hasNote && (
          <Text size="b4" className="text-white/80">
            {note}
          </Text>
        )}
      </VStack>
    </WeatherCard>
  );
};

/** 백야·극야에는 시각 대신 상태 문장을, 하나만 있는 날은 있는 시각만 보여 준다. */
WeatherDetailGrid.SunTile = function SunTile({
  events,
  formatTime,
}: {
  events: SunEvents;
  formatTime: (date: Date) => string;
}) {
  const { t } = useTranslation('weather');
  const lines = match(events)
    .with({ kind: 'polarDay' }, () => [t('details.polarDay')])
    .with({ kind: 'polarNight' }, () => [t('details.polarNight')])
    .with({ kind: 'regular' }, ({ sunrise, sunset }) =>
      compact([
        sunrise == null ? null : t('details.sunrise', { time: formatTime(sunrise) }),
        sunset == null ? null : t('details.sunset', { time: formatTime(sunset) }),
      ]),
    )
    .exhaustive();
  const [value = t('details.noValue'), ...rest] = lines;
  const SunIcon = events.kind === 'polarNight' ? WeatherSunsetIcon : WeatherSunriseIcon;

  return (
    <WeatherDetailGrid.Tile
      title={t('details.sun')}
      icon={<SunIcon width={14} height={14} colorClassName="text-white/70" />}
      value={value}
      note={rest.join('\n')}
    />
  );
};

WeatherDetailGrid.Loading = function Loading() {
  return (
    <Grid columns={2} gap={GRID_GAP}>
      {times(LOADING_TILE_COUNT, (index) => (
        <GridItem key={index}>
          <WeatherCard>
            <TextSkeleton size="e1" className="w-16 opacity-40" />
            <TextSkeleton size="t2" className="w-12 opacity-40" />
          </WeatherCard>
        </GridItem>
      ))}
    </Grid>
  );
};

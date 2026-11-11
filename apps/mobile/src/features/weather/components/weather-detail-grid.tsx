import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { formatInstantHour } from '@src/shared/date/date-format';
import { type Instant } from '@src/shared/date/instant';
import { useMinuteNow } from '@src/shared/hooks/use-minute-now';
import { useTranslation } from '@src/shared/i18n';
import { Box, Grid, GridItem } from '@src/shared/ui';
import { formatDecimal } from '@src/shared/utils/number-format';
import { useSuspenseQueries } from '@tanstack/react-query';
import { range } from 'es-toolkit';
import { match } from 'ts-pattern';

import { UV_METER_COLORS } from '../constants/weather-colors.constants';
import {
  CLOUD_COVER_LEVEL_LABEL_KEYS,
  CLOUD_COVER_NOTE_KEYS,
  COMPASS_LABEL_KEYS,
  COMPASS_SHORT_LABEL_KEYS,
  FEELS_LIKE_LABEL_KEYS,
  FEELS_LIKE_NOTE_KEYS,
  PRESSURE_TREND_LABEL_KEYS,
  UV_LEVEL_LABEL_KEYS,
  VISIBILITY_LEVEL_LABEL_KEYS,
  WIND_LEVEL_NOTE_KEYS,
} from '../constants/weather-labels';
import { WeatherDetailPolicy } from '../domains/weather-detail.model';
import { WeatherIndicatorPolicy } from '../domains/weather-indicator.model';
import type { WeatherReport } from '../domains/weather-report.model';
import { useLocationDateFormat } from '../hooks/use-location-date-format';
import { useTemperatureUnit } from '../hooks/use-temperature-unit';
import { useGetWeatherReportQueryOptions, WeatherReportSelect } from '../queries/weather.queries';
import { toVisibilityKilometers } from '../utils/to-visibility-kilometers';
import { toUvMeterPosition } from '../utils/weather-bar.geometry';
import { toCompassDial, toPressureGauge } from '../utils/weather-dial.geometry';
import {
  formatDegrees,
  formatTemperature,
  toDisplayTemperature,
} from '../utils/weather-temperature';
import {
  TILE_GRID_GAP,
  useTileLayout,
  WeatherDialTile,
  WeatherTextTile,
  WeatherTile,
} from './weather-detail-tile';
import { WeatherCompass, WeatherPressureGauge } from './weather-dial';
import { WeatherMeter } from './weather-meter';

const LOADING_TILE_COUNT = 8;

/** 구름 단계에 낮밤을 더해 안내 문구 키를 고른다. 흐림은 낮밤이 같다. */
function getCloudCoverNoteKey(current: WeatherReport['current']) {
  const { isDaylight } = current;
  return match(WeatherIndicatorPolicy.getCloudCoverLevel(current))
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
  const [{ data }, { data: preference }] = useSuspenseQueries({
    queries: [
      { ...useGetWeatherReportQueryOptions(), select: WeatherReportSelect.details },
      useGetPreferenceQueryOptions(),
    ],
  });
  const dateFormat = useLocationDateFormat(data.location.timezone);
  const formatHour = (date: Instant) => formatInstantHour(date, preference.timeFormat, dateFormat);
  const formatSpeed = (metersPerSecond: number) =>
    formatDecimal(metersPerSecond, dateFormat.locale);
  const { current, hourly } = data;
  const now = useMinuteNow();

  const feelsLike = WeatherIndicatorPolicy.getFeelsLikeComparison(current);
  const feelsDifference = Math.abs(
    toDisplayTemperature(current.apparentTemperature, unit) -
      toDisplayTemperature(current.temperature, unit),
  );
  const sunscreen = WeatherDetailPolicy.findSunscreenWindow(hourly, now, data.location.timezone);
  const direction = WeatherIndicatorPolicy.getCompassDirection(current);
  const windSpeed = formatSpeed(current.windSpeed);
  const pressure = String(Math.round(current.pressure));
  const nextDayPrecipitation = WeatherDetailPolicy.calculateNextDayPrecipitation(hourly, now);
  const visibilityLevel = WeatherIndicatorPolicy.getVisibilityLevel(current);
  const cloudCoverNoteKey = getCloudCoverNoteKey(current);

  return (
    <Box onLayout={onLayout}>
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
            subtitle={t(UV_LEVEL_LABEL_KEYS[WeatherIndicatorPolicy.getUvLevel(current)])}
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
                ? t(WIND_LEVEL_NOTE_KEYS[WeatherIndicatorPolicy.getWindLevel(current)])
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
                        direction: t(COMPASS_SHORT_LABEL_KEYS[direction]),
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
              WeatherIndicatorPolicy.isMuggy(current)
                ? t('details.muggy')
                : t('details.comfortable')
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
              CLOUD_COVER_LEVEL_LABEL_KEYS[WeatherIndicatorPolicy.getCloudCoverLevel(current)],
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
    <Box onLayout={onLayout}>
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

import {
  WEATHER_CONDITIONS,
  WEATHER_MOON_PHASES,
  WEATHER_PRECIPITATION_TYPES,
} from '@aido/api/vocabulary';
import { MINUTE_MS, MINUTES_PER_HOUR } from '@src/shared/constants/time-units';
import { dateKeySchema, type DateKey } from '@src/shared/date/date-key';
import { type Instant, instantSchema, toEpochMs } from '@src/shared/date/instant';
import { z } from 'zod';

const dayPartForecastSchema = z.object({
  condition: z.enum(WEATHER_CONDITIONS),
  temperatureMin: z.number().nullable(),
  temperatureMax: z.number().nullable(),
  precipitationChance: z.number(),
});

/** 하루의 예보. date는 예보 위치 시간대의 날짜다 */
export const forecastDaySchema = z.object({
  date: dateKeySchema,
  condition: z.enum(WEATHER_CONDITIONS),
  temperatureMin: z.number(),
  temperatureMax: z.number(),
  precipitationChance: z.number(),
  precipitationAmount: z.number(),
  precipitationType: z.enum(WEATHER_PRECIPITATION_TYPES),
  uvIndexMax: z.number(),
  windSpeedMax: z.number().nullable(),
  windGustMax: z.number().nullable(),
  sunrise: instantSchema.nullable(),
  sunset: instantSchema.nullable(),
  moonPhase: z.enum(WEATHER_MOON_PHASES),
  moonrise: instantSchema.nullable(),
  moonset: instantSchema.nullable(),
  // 지금부터 그날 끝까지. 오늘 항목에만 있다
  restOfDay: dayPartForecastSchema.nullable(),
  daytime: dayPartForecastSchema.nullable(),
  overnight: dayPartForecastSchema.nullable(),
});
export type ForecastDay = z.infer<typeof forecastDaySchema>;

export type SunEvents =
  | { kind: 'regular'; sunrise: Instant | null; sunset: Instant | null }
  | { kind: 'polarDay' }
  | { kind: 'polarNight' };

export type NextSunEvent =
  | { kind: 'sunrise'; at: Instant }
  | { kind: 'sunset'; at: Instant }
  | { kind: 'sunriseTomorrow'; at: Instant };

interface DaylightDuration {
  hours: number;
  minutes: number;
}

export const ForecastDayPolicy = {
  /** 일출·일몰이 모두 없으면 백야·극야인데, 둘을 가르는 값이 계약에 없어 지금 낮인지로 정한다 */
  getSunEvents(day: ForecastDay, isDaylightNow: boolean): SunEvents {
    if (day.sunrise == null && day.sunset == null) {
      return { kind: isDaylightNow ? 'polarDay' : 'polarNight' };
    }
    return { kind: 'regular', sunrise: day.sunrise, sunset: day.sunset };
  },

  /** 그날 아직 지나지 않은 일출·일몰, 둘 다 지났으면 다음 날 일출. 모두 없으면 null이다. */
  findNextSunEvent(
    day: ForecastDay,
    nextDay: ForecastDay | null,
    now: Instant,
  ): NextSunEvent | null {
    if (day.sunrise != null && toEpochMs(now) < toEpochMs(day.sunrise)) {
      return { kind: 'sunrise', at: day.sunrise };
    }
    if (day.sunset != null && toEpochMs(now) < toEpochMs(day.sunset)) {
      return { kind: 'sunset', at: day.sunset };
    }
    if (nextDay?.sunrise != null) {
      return { kind: 'sunriseTomorrow', at: nextDay.sunrise };
    }
    return null;
  },

  findDaylightDuration(day: ForecastDay): DaylightDuration | null {
    if (day.sunrise == null || day.sunset == null) {
      return null;
    }
    const totalMinutes = Math.max(
      0,
      Math.round((toEpochMs(day.sunset) - toEpochMs(day.sunrise)) / MINUTE_MS),
    );
    return {
      hours: Math.floor(totalMinutes / MINUTES_PER_HOUR),
      minutes: totalMinutes % MINUTES_PER_HOUR,
    };
  },

  /** 그 날짜의 예보. 일별 예보에 그 날짜가 없으면(날짜 경계의 지연) 첫 예보를 그날처럼 쓴다. */
  findOnDateOrFirst(daily: readonly ForecastDay[], dateKey: DateKey): ForecastDay | null {
    return daily.find((day) => day.date === dateKey) ?? daily[0] ?? null;
  },

  /** 그 날짜 다음 날짜(YYYY-MM-DD)의 예보. 예보 범위를 넘으면 null이다. */
  findDayAfter(daily: readonly ForecastDay[], dateKey: DateKey): ForecastDay | null {
    return daily.find((day) => dateKey < day.date) ?? null;
  },

  /** 그 날짜 뒤로 처음 오는 보름달 날짜(YYYY-MM-DD). 예보 범위(최대 10일) 안에 없으면 null이다. */
  findNextFullMoon(daily: readonly ForecastDay[], dateKey: DateKey): DateKey | null {
    return daily.find((day) => dateKey < day.date && day.moonPhase === 'FULL')?.date ?? null;
  },
};

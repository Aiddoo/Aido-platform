import {
  WeatherReport,
  type WeatherReportDay,
  type WeatherReportHour,
  type WeatherReportPrimitives,
} from "#api/modules/weather/weather-reports/domain/weather-report.aggregate";

const WEATHER_REPORT_FIXTURE_FETCHED_AT = Temporal.Instant.from("2026-11-02T06:20:00.000Z");
const WEATHER_REPORT_FIXTURE_CELL_KEY = "wydm9";

/** fetchedAt 정각부터 30시간·11일을 담은 서울 칸 리포트. 필요한 칸만 덮어쓴다 */
export function createWeatherReportFixture(
  overrides: Partial<WeatherReportPrimitives> = {},
): WeatherReport {
  const fetchedAt = overrides.fetchedAt ?? WEATHER_REPORT_FIXTURE_FETCHED_AT;
  const hourStart = fetchedAt.round({ smallestUnit: "hour", roundingMode: "floor" });
  const hourly = Array.from({ length: 30 }, (_, index): WeatherReportHour => ({
    startsAt: hourStart.add({ hours: index }),
    condition: "CLEAR",
    isDaylight: true,
    temperature: 12 + (index % 5),
    apparentTemperature: 10,
    humidity: 60,
    uvIndex: 1,
    windSpeed: 3.2,
    windDirection: 270,
    precipitationChance: 10,
    precipitationAmount: 0,
    precipitationType: "NONE",
  }));
  const firstDay = fetchedAt.toZonedDateTimeISO("UTC").toPlainDate();
  const daily = Array.from({ length: 11 }, (_, index): WeatherReportDay => {
    const utcMidnight = firstDay.add({ days: index }).toZonedDateTime("UTC").toInstant();
    return {
      date: firstDay.add({ days: index }),
      condition: "PARTLY_CLOUDY",
      temperatureMin: 8,
      temperatureMax: 16,
      precipitationChance: 20,
      precipitationAmount: 0.4,
      precipitationType: "RAIN",
      snowfallAmount: 0,
      uvIndexMax: 3,
      windSpeedMax: 5.1,
      windGustMax: null,
      sunrise: utcMidnight.subtract({ hours: 2 }),
      sunset: utcMidnight.add({ hours: 8 }),
      moonPhase: "WANING_CRESCENT",
      moonrise: null,
      moonset: utcMidnight.add({ hours: 5 }),
      restOfDay: null,
      daytime: null,
      overnight: null,
    };
  });
  return WeatherReport.reconstitute({
    cellKey: WEATHER_REPORT_FIXTURE_CELL_KEY,
    current: {
      observedAt: fetchedAt,
      condition: "CLEAR",
      isDaylight: true,
      temperature: 12.4,
      apparentTemperature: 10.1,
      dewPoint: 4.5,
      humidity: 58,
      cloudCover: 10,
      uvIndex: 1,
      windSpeed: 3.2,
      windGust: null,
      windDirection: 270,
      visibility: 20_000,
      pressure: 1018.2,
      pressureTrend: "STEADY",
      precipitationIntensity: 0,
    },
    nextHour: null,
    hourly,
    daily,
    alerts: [],
    fetchedAt,
    validUntil: null,
    ...overrides,
  });
}

/**
 * WeatherKit REST `GET /api/v1/weather` 응답 fixture
 *
 * Apple 문서의 필드 이름·단위(km/h, 0~1 비율, mb)를 그대로 쓴 고정 JSON이다. 실제 공급자를 호출하지 않는다.
 * `weatherkit/*-observed.json`은 2026-11-02 운영 키로 한 번 받아 둔 실제 응답(비밀값 없음)이다.
 */
import { readFileSync } from "node:fs";
import path from "node:path";

function observed(name: "seoul" | "tokyo"): unknown {
  return JSON.parse(
    readFileSync(path.join(import.meta.dirname, "weatherkit", `${name}-observed.json`), "utf8"),
  );
}

const FETCHED_AT = "2026-11-02T06:20:00Z";

interface WeatherKitFixtureBody {
  currentWeather?: Record<string, unknown>;
  forecastNextHour?: Record<string, unknown>;
  forecastHourly?: Record<string, unknown>;
  forecastDaily?: Record<string, unknown>;
  weatherAlerts?: Record<string, unknown>;
}

function currentWeather(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    name: "CurrentWeather",
    metadata: { units: "m", version: 1 },
    asOf: FETCHED_AT,
    cloudCover: 0.98,
    conditionCode: "Rain",
    daylight: true,
    humidity: 0.88,
    precipitationIntensity: 1.2,
    pressure: 1_012.3,
    pressureTrend: "falling",
    temperature: 12.4,
    temperatureApparent: 9.1,
    temperatureDewPoint: 10.5,
    uvIndex: 1,
    visibility: 8_000,
    windDirection: 315,
    windGust: 33.1,
    windSpeed: 16.56,
    ...overrides,
  };
}

function hours(startIso: string, count: number, overrides: Record<string, unknown> = {}) {
  const startMs = Date.parse(startIso);
  return Array.from({ length: count }, (_, index) => ({
    forecastStart: new Date(startMs + index * 3_600_000).toISOString().replace(".000", ""),
    cloudCover: 0.9,
    conditionCode: index < 3 ? "Rain" : "Cloudy",
    daylight: index < 3,
    humidity: 0.85,
    precipitationAmount: index < 3 ? 0.8 : 0,
    precipitationChance: index < 3 ? 0.6 : 0.1,
    precipitationType: index < 3 ? "rain" : "clear",
    pressure: 1_012,
    pressureTrend: "steady",
    snowfallIntensity: 0,
    temperature: 12 - index * 0.1,
    temperatureApparent: 9,
    temperatureDewPoint: 10,
    uvIndex: 1,
    visibility: 9_000,
    windDirection: 360,
    windGust: 30,
    windSpeed: 18,
    ...overrides,
  }));
}

function dayPart(conditionCode: string, overrides: Record<string, unknown> = {}) {
  return {
    forecastStart: "2026-11-01T22:00:00Z",
    forecastEnd: "2026-11-02T10:00:00Z",
    cloudCover: 0.9,
    conditionCode,
    humidity: 0.8,
    precipitationAmount: 5.1,
    precipitationChance: 0.8,
    precipitationType: "rain",
    snowfallAmount: 0,
    temperatureMax: 14,
    temperatureMin: 10,
    windDirection: 300,
    windSpeed: 20,
    ...overrides,
  };
}

function days(
  firstLocalMidnightIso: string,
  count: number,
  overrides: Record<string, unknown> = {},
) {
  const startMs = Date.parse(firstLocalMidnightIso);
  return Array.from({ length: count }, (_, index) => {
    const dayStartMs = startMs + index * 86_400_000;
    return {
      forecastStart: new Date(dayStartMs).toISOString().replace(".000", ""),
      forecastEnd: new Date(dayStartMs + 86_400_000).toISOString().replace(".000", ""),
      conditionCode: index === 0 ? "Rain" : "PartlyCloudy",
      maxUvIndex: 2,
      moonPhase: "waningCrescent",
      precipitationAmount: index === 0 ? 6.5 : 0,
      precipitationChance: index === 0 ? 0.8 : 0.1,
      precipitationType: index === 0 ? "rain" : "clear",
      snowfallAmount: 0,
      sunrise: new Date(dayStartMs + 6.85 * 3_600_000).toISOString(),
      sunset: new Date(dayStartMs + 17.47 * 3_600_000).toISOString(),
      temperatureMax: 14,
      temperatureMin: 8,
      windGustSpeedMax: 41,
      windSpeedMax: 22,
      daytimeForecast: dayPart("Rain"),
      overnightForecast: dayPart("Cloudy", {
        precipitationAmount: 1.4,
        precipitationChance: 0.3,
        temperatureMax: 11,
        temperatureMin: 8,
      }),
      ...overrides,
    };
  });
}

/** 서울 비: 한국은 분 단위 예보·특보 dataset을 제공하지 않아 세 dataset만 온다 */
function seoulRain(): WeatherKitFixtureBody {
  return {
    currentWeather: currentWeather(),
    forecastHourly: { name: "HourlyForecast", hours: hours("2026-11-02T06:00:00Z", 30) },
    forecastDaily: { name: "DailyForecast", days: days("2026-11-01T15:00:00Z", 11) },
  };
}

/** 뉴욕 폭우: 분 단위 예보와 특보 2건(심각도 낮은 것부터)까지 다섯 dataset이 모두 온다 */
function newYorkStorm(): WeatherKitFixtureBody {
  return {
    currentWeather: currentWeather(),
    forecastNextHour: {
      name: "NextHourForecast",
      forecastStart: "2026-11-02T06:20:00Z",
      forecastEnd: "2026-11-02T07:25:00Z",
      summary: [
        {
          startTime: "2026-11-02T06:20:00Z",
          endTime: "2026-11-02T06:43:00Z",
          condition: "clear",
          precipitationChance: 0,
          precipitationIntensity: 0,
        },
        {
          startTime: "2026-11-02T06:43:00Z",
          condition: "rain",
          precipitationChance: 0.8,
          precipitationIntensity: 2.4,
        },
      ],
      minutes: Array.from({ length: 60 }, (_, index) => ({
        startTime: new Date(Date.parse("2026-11-02T06:20:00Z") + index * 60_000)
          .toISOString()
          .replace(".000", ""),
        precipitationChance: index < 23 ? 0.2 : 0.8,
        precipitationIntensity: index < 23 ? 0 : 2.4,
      })),
    },
    forecastHourly: { name: "HourlyForecast", hours: hours("2026-11-02T06:00:00Z", 30) },
    forecastDaily: { name: "DailyForecast", days: days("2026-11-02T05:00:00Z", 11) },
    weatherAlerts: {
      detailsUrl: "https://weatherkit.apple.com/alertDetails/index.html",
      alerts: [
        {
          name: "WeatherAlert",
          id: "alert-minor",
          areaName: "New York (Manhattan)",
          countryCode: "US",
          description: "Air Quality Alert",
          effectiveTime: "2026-11-02T00:00:00Z",
          expireTime: "2026-11-03T00:00:00Z",
          issuedTime: "2026-11-01T23:00:00Z",
          detailsUrl: "https://weatherkit.apple.com/alertDetails/alert-minor",
          precedence: 0,
          severity: "minor",
          source: "National Weather Service",
          urgency: "expected",
          certainty: "likely",
        },
        {
          name: "WeatherAlert",
          id: "alert-severe",
          countryCode: "US",
          description: "Flash Flood Warning",
          effectiveTime: "2026-11-02T05:00:00Z",
          expireTime: "2026-11-02T18:00:00Z",
          issuedTime: "2026-11-02T04:50:00Z",
          detailsUrl: "https://weatherkit.apple.com/alertDetails/alert-severe",
          precedence: 0,
          severity: "severe",
          source: "National Weather Service",
        },
      ],
    },
  };
}

/** 도쿄 맑음: 분 단위 예보 없음, 특보 없음 */
function tokyoClear(): WeatherKitFixtureBody {
  return {
    currentWeather: currentWeather({
      conditionCode: "Clear",
      cloudCover: 0.02,
      humidity: 0.45,
      precipitationIntensity: 0,
      pressureTrend: "rising",
    }),
    forecastHourly: {
      hours: hours("2026-11-02T06:00:00Z", 30, {
        conditionCode: "Clear",
        precipitationType: "clear",
      }),
    },
    forecastDaily: { days: days("2026-11-01T15:00:00Z", 11, { conditionCode: "Clear" }) },
    weatherAlerts: { alerts: [] },
  };
}

/** 하노이: 이 지역에는 forecastNextHour·weatherAlerts dataset이 오지 않는다 */
function hanoiWithoutNextHour(): WeatherKitFixtureBody {
  return {
    currentWeather: currentWeather({ conditionCode: "Haze", temperature: 27 }),
    forecastHourly: { hours: hours("2026-11-02T06:00:00Z", 30) },
    forecastDaily: { days: days("2026-11-01T17:00:00Z", 11) },
  };
}

/** 극야(트롬쇠 12월): 일출·일몰과 낮 예보 기온이 없다 */
function polarNight(): WeatherKitFixtureBody {
  return {
    currentWeather: currentWeather({
      conditionCode: "Snow",
      daylight: false,
      temperature: -8,
      windGust: undefined,
      windDirection: undefined,
    }),
    forecastHourly: { hours: hours("2026-12-15T10:00:00Z", 30, { windDirection: undefined }) },
    forecastDaily: {
      days: days("2026-12-14T23:00:00Z", 11, {
        sunrise: undefined,
        sunset: undefined,
        windGustSpeedMax: undefined,
        windSpeedMax: undefined,
        moonPhase: "full",
        precipitationType: "snow",
        snowfallAmount: 12,
        daytimeForecast: dayPart("Snow", { temperatureMax: undefined, temperatureMin: undefined }),
        overnightForecast: undefined,
      }),
    },
  };
}

/** Apple이 새로 추가한 enum 값(conditionCode·precipitationType·moonPhase·severity·pressureTrend) */
function unknownConditionCode(): WeatherKitFixtureBody {
  const base = newYorkStorm();
  return {
    ...base,
    currentWeather: currentWeather({ conditionCode: "VolcanicAsh", pressureTrend: "wobbly" }),
    forecastHourly: {
      hours: hours("2026-11-02T06:00:00Z", 2, {
        conditionCode: "Sandstorm",
        precipitationType: "ice-pellets",
      }),
    },
    forecastDaily: { days: days("2026-11-01T15:00:00Z", 1, { moonPhase: "blueMoon" }) },
    weatherAlerts: {
      alerts: [
        {
          id: "alert-new-severity",
          description: "Special Statement",
          effectiveTime: "2026-11-02T05:00:00Z",
          expireTime: "2026-11-02T18:00:00Z",
          detailsUrl: "https://weatherkit.apple.com/alertDetails/alert-new-severity",
          severity: "catastrophic",
          source: "KMA",
        },
      ],
    },
  };
}

/** `GET /api/v1/availability/{lat}/{lon}` 응답: 그 위치에서 제공하는 dataset 이름 배열 */
function availability(...dataSets: readonly string[]): string[] {
  return dataSets.length === 0
    ? ["currentWeather", "forecastDaily", "forecastHourly"]
    : [...dataSets];
}

export const WeatherKitReportFixture = {
  fetchedAt: FETCHED_AT,
  availability,
  seoulObserved: () => observed("seoul"),
  tokyoObserved: () => observed("tokyo"),
  seoulRain,
  newYorkStorm,
  tokyoClear,
  hanoiWithoutNextHour,
  polarNight,
  unknownConditionCode,
} as const;

import type { SkyCondition } from "@aido/api/vocabulary";
import { maxBy, sortBy } from "es-toolkit";

import { localDateIn } from "#api/shared/domain/time/time-zone-name";

import type {
  DailyForecastReadModel,
  HourlyForecastReadModel,
  WeatherForecastReadModel,
} from "../../application/read-models/weather-forecast.read-model.js";
import { KMA_CATEGORY, KMA_TIMEZONE, PTY_CODE_MAP, SKY_CODE_MAP } from "./kma.constants.js";
import type { KmaApiResponse, KmaResponseItem } from "./kma.wire.js";

/**
 * YYYYMMDD 형식을 YYYY-MM-DD로 변환
 */
function formatDateString(yyyymmdd: string): string {
  return `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
}

/**
 * 가장 빈도 높은 코드를 반환 (비어 있으면 fallback). 횟수가 같으면 먼저 센 코드다
 */
function mostFrequentCode(counts: Map<string, number>, fallback: string): string {
  return maxBy([...counts], ([, count]) => count)?.[0] ?? fallback;
}

/**
 * 특정 날짜의 아이템들로부터 DailyForecastReadModel를 생성
 */
function buildDailyForecast(dateKey: string, dateItems: KmaResponseItem[]): DailyForecastReadModel {
  let temperatureMin = Number.POSITIVE_INFINITY;
  let temperatureMax = Number.NEGATIVE_INFINITY;
  let maxPrecipitationProbability = 0;
  const skyCounts = new Map<string, number>();
  const precipitationTypeCounts = new Map<string, number>();

  for (const forecast of dateItems) {
    const value = forecast.fcstValue;
    const category = forecast.category;

    if (category === KMA_CATEGORY.TMP) {
      const temperature = Number.parseFloat(value);
      if (!Number.isNaN(temperature)) {
        temperatureMin = Math.min(temperatureMin, temperature);
        temperatureMax = Math.max(temperatureMax, temperature);
      }
    } else if (category === KMA_CATEGORY.TMN) {
      const lowestTemperature = Number.parseFloat(value);
      if (!Number.isNaN(lowestTemperature)) {
        temperatureMin = Math.min(temperatureMin, lowestTemperature);
      }
    } else if (category === KMA_CATEGORY.TMX) {
      const highestTemperature = Number.parseFloat(value);
      if (!Number.isNaN(highestTemperature)) {
        temperatureMax = Math.max(temperatureMax, highestTemperature);
      }
    } else if (category === KMA_CATEGORY.POP) {
      const probability = Number.parseInt(value, 10);
      if (!Number.isNaN(probability)) {
        maxPrecipitationProbability = Math.max(maxPrecipitationProbability, probability);
      }
    } else if (category === KMA_CATEGORY.SKY) {
      skyCounts.set(value, (skyCounts.get(value) ?? 0) + 1);
    } else if (category === KMA_CATEGORY.PTY && value !== "0") {
      precipitationTypeCounts.set(value, (precipitationTypeCounts.get(value) ?? 0) + 1);
    }
  }

  return {
    date: formatDateString(dateKey),
    skyCondition: SKY_CODE_MAP[mostFrequentCode(skyCounts, "1")] ?? "CLEAR",
    precipitationType: PTY_CODE_MAP[mostFrequentCode(precipitationTypeCounts, "0")] ?? "NONE",
    precipitationProbability: maxPrecipitationProbability,
    temperatureMin: temperatureMin === Number.POSITIVE_INFINITY ? 0 : temperatureMin,
    temperatureMax: temperatureMax === Number.NEGATIVE_INFINITY ? 0 : temperatureMax,
  };
}

interface HourlyEntry {
  temperature: number;
  skyCondition: SkyCondition;
  precipitationProbability: number;
  precipitationAmount: number;
  snowAmount: number;
}

/** 시간 칸 하나에 값을 넣는다. 값이 숫자가 아니면 칸을 만들지 않는다(하늘 상태는 늘 넣는다) */
function applyHourlyValue(entry: HourlyEntry, forecast: KmaResponseItem): boolean {
  const value = forecast.fcstValue;
  const category = forecast.category;
  if (category === KMA_CATEGORY.TMP) {
    const temperature = Number.parseFloat(value);
    if (Number.isNaN(temperature)) {
      return false;
    }
    entry.temperature = temperature;
    return true;
  }
  if (category === KMA_CATEGORY.POP) {
    const probability = Number.parseInt(value, 10);
    if (Number.isNaN(probability)) {
      return false;
    }
    entry.precipitationProbability = probability;
    return true;
  }
  if (category === KMA_CATEGORY.SKY) {
    entry.skyCondition = SKY_CODE_MAP[value] ?? "CLEAR";
    return true;
  }
  if (category === KMA_CATEGORY.PCP) {
    const amount = Number.parseFloat(value);
    if (Number.isNaN(amount)) {
      return false;
    }
    entry.precipitationAmount = amount;
    return true;
  }
  if (category === KMA_CATEGORY.SNO) {
    const amount = Number.parseFloat(value);
    if (Number.isNaN(amount)) {
      return false;
    }
    entry.snowAmount = amount;
    return true;
  }
  return false;
}

/** 대상 날짜와 다음 날의 시간별 칸. 다음 날은 24+hour 키로 둔다 */
function collectHourly(items: readonly KmaResponseItem[], nextDateKey: string) {
  const hourlyMap = new Map<number, HourlyEntry>();
  for (const forecast of items) {
    const hour = Number.parseInt(forecast.fcstTime.slice(0, 2), 10);
    const key = forecast.fcstDate === nextDateKey ? 24 + hour : hour;
    const entry = hourlyMap.get(key) ?? {
      temperature: 0,
      skyCondition: "CLEAR",
      precipitationProbability: 0,
      precipitationAmount: 0,
      snowAmount: 0,
    };
    if (applyHourlyValue(entry, forecast)) {
      hourlyMap.set(key, entry);
    }
  }
  return hourlyMap;
}

interface TargetDaySummary {
  temperatureMin: number;
  temperatureMax: number;
  maxPrecipitationProbability: number;
  dominantSky: string;
  readonly precipitationTypeCounts: Map<string, number>;
  humiditySum: number;
  humidityCount: number;
  windSum: number;
  windCount: number;
}

function addTargetDayValue(summary: TargetDaySummary, forecast: KmaResponseItem): void {
  const value = forecast.fcstValue;
  const category = forecast.category;
  if (category === KMA_CATEGORY.POP) {
    const probability = Number.parseInt(value, 10);
    if (!Number.isNaN(probability)) {
      summary.maxPrecipitationProbability = Math.max(
        summary.maxPrecipitationProbability,
        probability,
      );
    }
  } else if (category === KMA_CATEGORY.SKY) {
    summary.dominantSky = value;
  } else if (category === KMA_CATEGORY.TMN) {
    const lowestTemperature = Number.parseFloat(value);
    if (!Number.isNaN(lowestTemperature)) {
      summary.temperatureMin = Math.min(summary.temperatureMin, lowestTemperature);
    }
  } else if (category === KMA_CATEGORY.TMX) {
    const highestTemperature = Number.parseFloat(value);
    if (!Number.isNaN(highestTemperature)) {
      summary.temperatureMax = Math.max(summary.temperatureMax, highestTemperature);
    }
  } else if (category === KMA_CATEGORY.PTY) {
    if (value !== "0") {
      summary.precipitationTypeCounts.set(
        value,
        (summary.precipitationTypeCounts.get(value) ?? 0) + 1,
      );
    }
  } else if (category === KMA_CATEGORY.REH) {
    const humidity = Number.parseInt(value, 10);
    if (!Number.isNaN(humidity)) {
      summary.humiditySum += humidity;
      summary.humidityCount++;
    }
  } else if (category === KMA_CATEGORY.WSD) {
    const windSpeed = Number.parseFloat(value);
    if (!Number.isNaN(windSpeed)) {
      summary.windSum += windSpeed;
      summary.windCount++;
    }
  }
}

function summarizeTargetDay(items: readonly KmaResponseItem[]): TargetDaySummary {
  const summary: TargetDaySummary = {
    temperatureMin: Number.POSITIVE_INFINITY,
    temperatureMax: Number.NEGATIVE_INFINITY,
    maxPrecipitationProbability: 0,
    dominantSky: "1", // 기본: 맑음
    precipitationTypeCounts: new Map<string, number>(),
    humiditySum: 0,
    humidityCount: 0,
    windSum: 0,
    windCount: 0,
  };
  for (const forecast of items) {
    addTargetDayValue(summary, forecast);
  }
  return summary;
}

/**
 * 기상청 단기예보 응답을 WeatherForecastReadModel로 변환
 */
export function parseKmaResponse(
  forecastResponse: KmaApiResponse,
  target: Temporal.Instant,
): WeatherForecastReadModel {
  const allItems = forecastResponse.response.body?.items?.item ?? [];
  const localDate = localDateIn(target, KMA_TIMEZONE);
  const targetDateKey = localDate.toString().replaceAll("-", "");
  const nextDateKey = localDate.add({ days: 1 }).toString().replaceAll("-", "");

  const relevantItems = allItems.filter(
    (forecast) => forecast.fcstDate === targetDateKey || forecast.fcstDate === nextDateKey,
  );
  const hourlyMap = collectHourly(relevantItems, nextDateKey);
  const summary = summarizeTargetDay(
    relevantItems.filter((forecast) => forecast.fcstDate === targetDateKey),
  );

  // TMN/TMX가 없으면 시간별 기온에서 추출
  if (
    summary.temperatureMin === Number.POSITIVE_INFINITY ||
    summary.temperatureMax === Number.NEGATIVE_INFINITY
  ) {
    for (const entry of hourlyMap.values()) {
      if (entry.temperature !== 0) {
        summary.temperatureMin = Math.min(summary.temperatureMin, entry.temperature);
        summary.temperatureMax = Math.max(summary.temperatureMax, entry.temperature);
      }
    }
  }

  // 시간별 예보 배열 생성 (24+hour → hour % 24 변환)
  const hourlyForecasts: HourlyForecastReadModel[] = sortBy([...hourlyMap], [([hour]) => hour]).map(
    ([hour, entry]) => ({ hour: hour % 24, ...entry }),
  );

  // 일별 예보 생성 (모든 날짜 대상)
  const dailyForecasts: DailyForecastReadModel[] = sortBy(
    [...Map.groupBy(allItems, (forecast) => forecast.fcstDate)],
    [([dateKey]) => dateKey],
  ).map(([dateKey, items]) => buildDailyForecast(dateKey, items));

  return {
    date: target,
    skyCondition: SKY_CODE_MAP[summary.dominantSky] ?? "CLEAR",
    precipitationType:
      PTY_CODE_MAP[mostFrequentCode(summary.precipitationTypeCounts, "0")] ?? "NONE",
    precipitationProbability: summary.maxPrecipitationProbability,
    temperatureMin:
      summary.temperatureMin === Number.POSITIVE_INFINITY ? 0 : summary.temperatureMin,
    temperatureMax:
      summary.temperatureMax === Number.NEGATIVE_INFINITY ? 0 : summary.temperatureMax,
    humidity:
      summary.humidityCount > 0 ? Math.round(summary.humiditySum / summary.humidityCount) : 0,
    windSpeed:
      summary.windCount > 0 ? Math.round((summary.windSum / summary.windCount) * 10) / 10 : 0,
    hourlyForecasts,
    dailyForecasts,
  };
}

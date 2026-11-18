import type { SkyCondition } from "@aido/api/vocabulary";

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
  return `${yyyymmdd.substring(0, 4)}-${yyyymmdd.substring(4, 6)}-${yyyymmdd.substring(6, 8)}`;
}

/**
 * 가장 빈도 높은 코드를 반환 (비어 있으면 fallback)
 */
function mostFrequentCode(counts: Map<string, number>, fallback: string): string {
  let dominantCode = fallback;
  let maxCount = 0;
  for (const [code, count] of counts) {
    if (count > maxCount) {
      maxCount = count;
      dominantCode = code;
    }
  }
  return dominantCode;
}

/**
 * 특정 날짜의 아이템들로부터 DailyForecastReadModel를 생성
 */
function buildDailyForecast(dateKey: string, dateItems: KmaResponseItem[]): DailyForecastReadModel {
  let tempMin = Number.POSITIVE_INFINITY;
  let tempMax = Number.NEGATIVE_INFINITY;
  let maxPrecipProb = 0;
  const skyCounts = new Map<string, number>();
  const ptyCounts = new Map<string, number>();

  for (const item of dateItems) {
    const value = item.fcstValue;

    switch (item.category) {
      case KMA_CATEGORY.TMP: {
        const temp = Number.parseFloat(value);
        if (!Number.isNaN(temp)) {
          tempMin = Math.min(tempMin, temp);
          tempMax = Math.max(tempMax, temp);
        }
        break;
      }
      case KMA_CATEGORY.TMN: {
        const v = Number.parseFloat(value);
        if (!Number.isNaN(v)) {
          tempMin = Math.min(tempMin, v);
        }
        break;
      }
      case KMA_CATEGORY.TMX: {
        const v = Number.parseFloat(value);
        if (!Number.isNaN(v)) {
          tempMax = Math.max(tempMax, v);
        }
        break;
      }
      case KMA_CATEGORY.POP: {
        const prob = Number.parseInt(value, 10);
        if (!Number.isNaN(prob)) {
          maxPrecipProb = Math.max(maxPrecipProb, prob);
        }
        break;
      }
      case KMA_CATEGORY.SKY: {
        skyCounts.set(value, (skyCounts.get(value) ?? 0) + 1);
        break;
      }
      case KMA_CATEGORY.PTY: {
        if (value !== "0") {
          ptyCounts.set(value, (ptyCounts.get(value) ?? 0) + 1);
        }
        break;
      }
    }
  }

  return {
    date: formatDateString(dateKey),
    skyCondition: SKY_CODE_MAP[mostFrequentCode(skyCounts, "1")] ?? "CLEAR",
    precipitationType: PTY_CODE_MAP[mostFrequentCode(ptyCounts, "0")] ?? "NONE",
    precipitationProbability: maxPrecipProb,
    temperatureMin: tempMin === Number.POSITIVE_INFINITY ? 0 : tempMin,
    temperatureMax: tempMax === Number.NEGATIVE_INFINITY ? 0 : tempMax,
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
function applyHourlyValue(entry: HourlyEntry, item: KmaResponseItem): boolean {
  const value = item.fcstValue;
  switch (item.category) {
    case KMA_CATEGORY.TMP: {
      const temp = Number.parseFloat(value);
      if (Number.isNaN(temp)) {
        return false;
      }
      entry.temperature = temp;
      return true;
    }
    case KMA_CATEGORY.POP: {
      const prob = Number.parseInt(value, 10);
      if (Number.isNaN(prob)) {
        return false;
      }
      entry.precipitationProbability = prob;
      return true;
    }
    case KMA_CATEGORY.SKY: {
      entry.skyCondition = SKY_CODE_MAP[value] ?? "CLEAR";
      return true;
    }
    case KMA_CATEGORY.PCP: {
      const amount = Number.parseFloat(value);
      if (Number.isNaN(amount)) {
        return false;
      }
      entry.precipitationAmount = amount;
      return true;
    }
    case KMA_CATEGORY.SNO: {
      const amount = Number.parseFloat(value);
      if (Number.isNaN(amount)) {
        return false;
      }
      entry.snowAmount = amount;
      return true;
    }
    default:
      return false;
  }
}

/** 대상 날짜와 다음 날의 시간별 칸. 다음 날은 24+hour 키로 둔다 */
function collectHourly(items: readonly KmaResponseItem[], nextDateKey: string) {
  const hourlyMap = new Map<number, HourlyEntry>();
  for (const item of items) {
    const hour = Number.parseInt(item.fcstTime.substring(0, 2), 10);
    const key = item.fcstDate === nextDateKey ? 24 + hour : hour;
    const entry = hourlyMap.get(key) ?? {
      temperature: 0,
      skyCondition: "CLEAR",
      precipitationProbability: 0,
      precipitationAmount: 0,
      snowAmount: 0,
    };
    if (applyHourlyValue(entry, item)) {
      hourlyMap.set(key, entry);
    }
  }
  return hourlyMap;
}

interface TargetDaySummary {
  tempMin: number;
  tempMax: number;
  maxPrecipProb: number;
  dominantSky: string;
  readonly ptyCounts: Map<string, number>;
  humiditySum: number;
  humidityCount: number;
  windSum: number;
  windCount: number;
}

function addTargetDayValue(summary: TargetDaySummary, item: KmaResponseItem): void {
  const value = item.fcstValue;
  switch (item.category) {
    case KMA_CATEGORY.POP: {
      const prob = Number.parseInt(value, 10);
      if (!Number.isNaN(prob)) {
        summary.maxPrecipProb = Math.max(summary.maxPrecipProb, prob);
      }
      return;
    }
    case KMA_CATEGORY.SKY:
      summary.dominantSky = value;
      return;
    case KMA_CATEGORY.TMN: {
      const v = Number.parseFloat(value);
      if (!Number.isNaN(v)) {
        summary.tempMin = Math.min(summary.tempMin, v);
      }
      return;
    }
    case KMA_CATEGORY.TMX: {
      const v = Number.parseFloat(value);
      if (!Number.isNaN(v)) {
        summary.tempMax = Math.max(summary.tempMax, v);
      }
      return;
    }
    case KMA_CATEGORY.PTY:
      if (value !== "0") {
        summary.ptyCounts.set(value, (summary.ptyCounts.get(value) ?? 0) + 1);
      }
      return;
    case KMA_CATEGORY.REH: {
      const v = Number.parseInt(value, 10);
      if (!Number.isNaN(v)) {
        summary.humiditySum += v;
        summary.humidityCount++;
      }
      return;
    }
    case KMA_CATEGORY.WSD: {
      const v = Number.parseFloat(value);
      if (!Number.isNaN(v)) {
        summary.windSum += v;
        summary.windCount++;
      }
      return;
    }
    default:
      return;
  }
}

function summarizeTargetDay(items: readonly KmaResponseItem[]): TargetDaySummary {
  const summary: TargetDaySummary = {
    tempMin: Number.POSITIVE_INFINITY,
    tempMax: Number.NEGATIVE_INFINITY,
    maxPrecipProb: 0,
    dominantSky: "1", // 기본: 맑음
    ptyCounts: new Map<string, number>(),
    humiditySum: 0,
    humidityCount: 0,
    windSum: 0,
    windCount: 0,
  };
  for (const item of items) {
    addTargetDayValue(summary, item);
  }
  return summary;
}

/**
 * 기상청 단기예보 응답을 WeatherForecastReadModel로 변환
 */
export function parseKmaResponse(
  data: KmaApiResponse,
  target: Temporal.Instant,
): WeatherForecastReadModel {
  const allItems = data.response.body?.items?.item ?? [];
  const localDate = localDateIn(target, KMA_TIMEZONE);
  const targetDateKey = localDate.toString().replaceAll("-", "");
  const nextDateKey = localDate.add({ days: 1 }).toString().replaceAll("-", "");

  const relevantItems = allItems.filter(
    (item) => item.fcstDate === targetDateKey || item.fcstDate === nextDateKey,
  );
  const hourlyMap = collectHourly(relevantItems, nextDateKey);
  const summary = summarizeTargetDay(
    relevantItems.filter((item) => item.fcstDate === targetDateKey),
  );

  // TMN/TMX가 없으면 시간별 기온에서 추출
  if (
    summary.tempMin === Number.POSITIVE_INFINITY ||
    summary.tempMax === Number.NEGATIVE_INFINITY
  ) {
    for (const entry of hourlyMap.values()) {
      if (entry.temperature !== 0) {
        summary.tempMin = Math.min(summary.tempMin, entry.temperature);
        summary.tempMax = Math.max(summary.tempMax, entry.temperature);
      }
    }
  }

  // 시간별 예보 배열 생성 (24+hour → hour % 24 변환)
  const hourlyForecasts: HourlyForecastReadModel[] = [...hourlyMap.entries()]
    .sort(([a], [b]) => a - b)
    .map(([hour, entry]) => ({ hour: hour % 24, ...entry }));

  // 일별 예보 생성 (모든 날짜 대상)
  const dailyForecasts: DailyForecastReadModel[] = [
    ...Map.groupBy(allItems, (item) => item.fcstDate),
  ]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([dateKey, items]) => buildDailyForecast(dateKey, items));

  return {
    date: target,
    skyCondition: SKY_CODE_MAP[summary.dominantSky] ?? "CLEAR",
    precipitationType: PTY_CODE_MAP[mostFrequentCode(summary.ptyCounts, "0")] ?? "NONE",
    precipitationProbability: summary.maxPrecipProb,
    temperatureMin: summary.tempMin === Number.POSITIVE_INFINITY ? 0 : summary.tempMin,
    temperatureMax: summary.tempMax === Number.NEGATIVE_INFINITY ? 0 : summary.tempMax,
    humidity:
      summary.humidityCount > 0 ? Math.round(summary.humiditySum / summary.humidityCount) : 0,
    windSpeed:
      summary.windCount > 0 ? Math.round((summary.windSum / summary.windCount) * 10) / 10 : 0,
    hourlyForecasts,
    dailyForecasts,
  };
}

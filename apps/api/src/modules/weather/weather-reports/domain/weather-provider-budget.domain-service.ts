import type { WEATHER_PROVIDER_BUDGET_STATES } from "./weather-reports.constants.js";

export type WeatherProviderBudgetState = (typeof WEATHER_PROVIDER_BUDGET_STATES)[number];

// 한도에 닿기 전에 남은 호출을 늘려 월말까지 버티도록 이 비율부터 아낀다
const SAVING_RATIO = 0.9;

interface WeatherProviderBudgetUsage {
  readonly usedCalls: number;
  readonly monthlyCallLimit: number;
}

/** 이번 달 쓴 호출 수로 예산 상태를 정한다. 한도 이상이면 exhausted, 90% 이상이면 saving이다. */
export function assessWeatherProviderBudget({
  usedCalls,
  monthlyCallLimit,
}: WeatherProviderBudgetUsage): WeatherProviderBudgetState {
  if (usedCalls >= monthlyCallLimit) {
    return "exhausted";
  }
  if (usedCalls >= monthlyCallLimit * SAVING_RATIO) {
    return "saving";
  }
  return "normal";
}

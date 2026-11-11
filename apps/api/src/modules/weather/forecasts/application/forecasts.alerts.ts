import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const ForecastAlerts = defineAlerts("weather", {
  WEATHERKIT_MONTHLY_CALLS: {
    key: "weather.weatherkit.monthly-calls",
    severity: "warning",
    summary: "WeatherKit 이번 달 호출 수가 무료 한도 경고 기준선에 닿았다",
    runbook:
      "details.total과 남은 일수로 무료 한도를 넘을지 가늠한다. 넘을 것 같으면 예보 캐시 TTL을 늘린다.",
  },
});

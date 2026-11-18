import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const WeatherReportAlerts = defineAlerts("weather", {
  WEATHERKIT_MONTHLY_CALLS: {
    key: "weather.weatherkit.monthly-calls.reached",
    severity: "warning",
    summary: "WeatherKit 이번 달 호출 수가 무료 한도 경고 기준선에 닿았다",
    runbook:
      "details.total과 남은 일수로 무료 한도를 넘을지 가늠한다. 90%에서 리포트 캐시를 저절로 늘리고 100%에서 호출을 멈추므로 늘어난 호출의 원인을 먼저 찾는다.",
  },
  WEATHERKIT_BUDGET_SAVING: {
    key: "weather.weatherkit.monthly-budget.saving",
    severity: "warning",
    summary: "WeatherKit 이번 달 호출이 무료 한도의 90%에 닿아 리포트 캐시를 2시간으로 늘렸다",
    runbook:
      "날씨가 최대 2시간 늦게 바뀐다. details.total과 남은 일수를 보고, 한도에 닿으면 호출을 멈추므로 늘어난 호출의 원인(캐시 밀림·배포 반복·칸 급증)을 찾는다.",
  },
  WEATHERKIT_BUDGET_EXHAUSTED: {
    key: "weather.weatherkit.monthly-budget.exhausted",
    severity: "error",
    summary: "WeatherKit 이번 달 무료 한도를 다 써서 공급자 호출을 멈췄다",
    runbook:
      "다음 달(UTC) 1일까지 칸마다 마지막 리포트(6시간)만 주고 그 뒤는 WEATHER_1901이다. 계속 써야 하면 Apple 유료 등급을 검토하고 WEATHERKIT_MONTHLY_CALL_LIMIT을 올려 배포한다.",
  },
});

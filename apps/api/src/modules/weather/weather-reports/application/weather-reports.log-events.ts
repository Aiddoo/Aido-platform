export const WeatherReportLogEvent = {
  PROVIDER_FAILED: "weather.forecast.provider.failed",
  FALLBACK_USED: "weather.forecast.fallback.used",
  CONDITIONS_FORECAST_UNAVAILABLE: "weather.conditions.forecast.unavailable",
  REPORT_FALLBACK_USED: "weather.report.fallback.used",
  REPORT_UNAVAILABLE: "weather.report.unavailable",
  REPORT_READ_FAILED: "weather.report.read.failed",
  REPORT_AIR_QUALITY_UNAVAILABLE: "weather.report.air-quality.unavailable",
  REPORT_CACHE_SCOPE_FAILED: "weather.report.cache-scope.failed",
  REPORT_BRIEFING_TODOS_UNAVAILABLE: "weather.report.briefing-todos.unavailable",
} as const;

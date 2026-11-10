export const ForecastLogEvent = {
  FORECAST_PROVIDER_FAILED: "weather.forecast.provider_failed",
  FORECAST_FALLBACK_USED: "weather.forecast.fallback_used",
  FORECAST_BATCH_READ: "weather.forecast.batch_read",
  FORECAST_DATE_UNAVAILABLE: "weather.forecast.date_unavailable",
  CONDITIONS_FORECAST_UNAVAILABLE: "weather.conditions.forecast_unavailable",
  REPORT_FALLBACK_USED: "weather.report.fallback_used",
  REPORT_UNAVAILABLE: "weather.report.unavailable",
  REPORT_READ_FAILED: "weather.report.read_failed",
  REPORT_AIR_QUALITY_UNAVAILABLE: "weather.report.air_quality_unavailable",
  REPORT_CACHE_SCOPE_FAILED: "weather.report.cache-scope.failed",
  REPORT_BRIEFING_TODOS_UNAVAILABLE: "weather.report.briefing_todos_unavailable",
} as const;

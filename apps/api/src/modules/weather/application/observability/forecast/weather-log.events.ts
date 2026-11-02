export const WeatherLogEvent = {
  FORECAST_PROVIDER_FAILED: "weather.forecast.provider_failed",
  FORECAST_FALLBACK_USED: "weather.forecast.fallback_used",
  FORECAST_BATCH_READ: "weather.forecast.batch_read",
  CONDITIONS_FORECAST_UNAVAILABLE: "weather.conditions.forecast_unavailable",
  REPORT_FALLBACK_USED: "weather.report.fallback_used",
  REPORT_UNAVAILABLE: "weather.report.unavailable",
  REPORT_AIR_QUALITY_UNAVAILABLE: "weather.report.air_quality_unavailable",
} as const;

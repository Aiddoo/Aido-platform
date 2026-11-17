export const WeatherKitLogEvent = {
  REQUEST_COMPLETED: "weather.weatherkit.request.completed",
  REQUEST_FAILED: "weather.weatherkit.request.failed",
  REQUEST_SKIPPED: "weather.weatherkit.request.skipped",
  DATASET_DROPPED: "weather.weatherkit.dataset.dropped",
  AVAILABILITY_FAILED: "weather.weatherkit.availability.failed",
  ATTRIBUTION_FAILED: "weather.weatherkit.attribution.failed",
  TOKEN_SIGNED: "weather.weatherkit.token.signed",
  MONTHLY_CALLS_REACHED: "weather.weatherkit.monthly-calls.reached",
  USAGE_RECORD_FAILED: "weather.weatherkit.usage-record.failed",
} as const;

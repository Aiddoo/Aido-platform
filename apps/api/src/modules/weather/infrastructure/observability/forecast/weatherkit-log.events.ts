export const WeatherKitLogEvent = {
  REQUEST_COMPLETED: "weather.weatherkit.request_completed",
  REQUEST_FAILED: "weather.weatherkit.request_failed",
  REQUEST_SKIPPED: "weather.weatherkit.request_skipped",
  DATASET_DROPPED: "weather.weatherkit.dataset_dropped",
  AVAILABILITY_FAILED: "weather.weatherkit.availability_failed",
  ATTRIBUTION_FAILED: "weather.weatherkit.attribution_failed",
  TOKEN_SIGNED: "weather.weatherkit.token_signed",
  MONTHLY_CALLS_REACHED: "weather.weatherkit.monthly_calls_reached",
  USAGE_RECORD_FAILED: "weather.weatherkit.usage_record_failed",
} as const;

export const WeatherKitLogEvent = {
  REQUEST_COMPLETED: "weather.weatherkit.request_completed",
  REQUEST_FAILED: "weather.weatherkit.request_failed",
  REQUEST_SKIPPED: "weather.weatherkit.request_skipped",
  DATASET_DROPPED: "weather.weatherkit.dataset_dropped",
  AVAILABILITY_FAILED: "weather.weatherkit.availability_failed",
  TOKEN_SIGNED: "weather.weatherkit.token_signed",
} as const;

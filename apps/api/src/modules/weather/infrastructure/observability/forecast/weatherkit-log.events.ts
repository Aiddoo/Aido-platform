export const WeatherKitLogEvent = {
  REQUEST_COMPLETED: "weather.weatherkit.request_completed",
  REQUEST_FAILED: "weather.weatherkit.request_failed",
  REQUEST_SKIPPED: "weather.weatherkit.request_skipped",
  OUTAGE_OPENED: "weather.weatherkit.outage_opened",
  OUTAGE_CLOSED: "weather.weatherkit.outage_closed",
  DATASET_DROPPED: "weather.weatherkit.dataset_dropped",
  AVAILABILITY_FAILED: "weather.weatherkit.availability_failed",
  ATTRIBUTION_FAILED: "weather.weatherkit.attribution_failed",
  TOKEN_SIGNED: "weather.weatherkit.token_signed",
} as const;

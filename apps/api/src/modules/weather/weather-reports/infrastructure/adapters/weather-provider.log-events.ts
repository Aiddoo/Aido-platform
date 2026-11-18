export const WeatherProviderLogEvent = {
  NOT_CONFIGURED: "weather.provider.configuration.missing",
  HTTP_FAILED: "weather.provider.http.failed",
  RESPONSE_UNAVAILABLE: "weather.provider.response.unavailable",
  REQUEST_FAILED: "weather.provider.request.failed",
  PREVIOUS_BASE_RETRIED: "weather.provider.previous-base.retried",
} as const;

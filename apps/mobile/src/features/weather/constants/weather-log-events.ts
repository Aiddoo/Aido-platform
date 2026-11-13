export const WEATHER_LOG_EVENT = {
  LOCATION_READ_FAILED: 'weather.location-read.failed',
  LOCATION_REGISTER_FAILED: 'weather.location-register.failed',
  LOCATION_PERMISSION_REQUEST_FAILED: 'weather.location-permission-request.failed',
  REPORT_LOCATION_READ_FAILED: 'weather.report-location-read.failed',
  REPORT_ENUM_FALLBACK: 'weather.report.enum-fallback',
  RESCHEDULE_UNDO_FAILED: 'weather.reschedule-undo.failed',
} as const;

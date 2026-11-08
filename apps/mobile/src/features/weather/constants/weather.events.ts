import type { WeatherAlertSeverity, WeatherRescheduleReason } from '@aido/api/vocabulary';

import type {
  WeatherBriefingKind,
  WeatherLocationRegisteredResult,
  WeatherOpenedEntry,
  WeatherPermissionResult,
  WeatherReportFailedCause,
} from '../utils/weather-analytics';
import type { TodoSuggestionReason } from '../utils/weather-briefing.view-model';

declare module '@src/shared/analytics/event-map' {
  interface AppEventMap {
    weather_location_permission_result: { result: WeatherPermissionResult };
    weather_alert_opened: { severity: WeatherAlertSeverity };
    weather_reschedule_opened: { todo_count: number; reason: WeatherRescheduleReason };
    weather_reschedule_applied: { moved_count: number; reason: WeatherRescheduleReason };
    weather_reschedule_undone: { moved_count: number; reason: WeatherRescheduleReason };
    weather_todo_suggestion_opened: { reason: TodoSuggestionReason };
    weather_opened: { entry: WeatherOpenedEntry };
    weather_briefing_shown: { kind: WeatherBriefingKind };
    weather_location_registered: { result: WeatherLocationRegisteredResult };
    weather_report_failed: { cause: WeatherReportFailedCause };
  }
}

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
    /** 날씨 화면 진입. 화면이 열릴 때 한 번 */
    weather_opened: { entry: WeatherOpenedEntry };
    /** 브리핑 노출. 화면이 열려 있는 동안 처음 보인 종류로 한 번 */
    weather_briefing_shown: { kind: WeatherBriefingKind };
    /** 화면을 연 뒤 위치 확인이 끝난 결과. 화면이 열려 있는 동안 한 번 */
    weather_location_registered: { result: WeatherLocationRegisteredResult };
    /** 리포트 경계가 실패를 보였다. 실패 화면마다 한 번 */
    weather_report_failed: { cause: WeatherReportFailedCause };
  }
}

export {};

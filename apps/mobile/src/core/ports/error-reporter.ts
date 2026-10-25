import type { Breadcrumb } from '@src/core/ports/breadcrumb';
import type { Severity } from '@src/core/ports/severity';

export type ErrorReporterFeature =
  | 'app_icon'
  | 'app_version'
  | 'auth'
  | 'auth_cold_start'
  | 'draft'
  | 'error_boundary'
  | 'lifecycle'
  | 'todo_comment'
  | 'todo_nudge'
  | 'weather_location'
  | 'widget';

export interface ErrorReporterContext {
  endpoint?: string;
  feature?: ErrorReporterFeature;
  method?: string;
  /** 클라이언트가 판단한 사유. */
  errorCode?: string;
  /** 서버가 내려준 `@aido/api/errors` 코드. 클라 판단(`errorCode`)과 섞지 않는다. */
  serverErrorCode?: string;
  statusCode?: number;
  severity?: Severity;
}

export interface ErrorReporter {
  captureException(error: Error, context?: ErrorReporterContext): void;
  captureMessage(message: string, context?: ErrorReporterContext): void;
  /** 이벤트 직전 행적을 타임라인에 남긴다(자체 이벤트 아님). category로 필터 가능. */
  addBreadcrumb(breadcrumb: Breadcrumb): void;
  setUserId(userId: string | null): void;
}

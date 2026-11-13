import type { UserReportReason, UserReportTargetType } from '@aido/api/vocabulary';

declare module '@src/shared/analytics/event-map' {
  /** 차단·신고. 상대 사용자 id·신고 상세는 넣지 않는다 */
  interface AppEventMap {
    user_blocked: undefined;
    user_unblocked: undefined;
    content_reported: { target_type: UserReportTargetType; reason: UserReportReason };
  }
}

import type { AdminNotificationChannel } from "../../domain/admin-notices.constants.js";
import type { AdminNotice } from "../read-models/admin-notice.read-model.js";

export type AdminNotifyOutcome =
  | { readonly status: "sent" }
  | { readonly status: "skipped"; readonly reason: "not_configured" }
  | { readonly status: "failed"; readonly retryable: boolean; readonly statusCode?: number };

/**
 * 관리자 알림 채널(Discord·Slack 등)의 벤더 중립 포트. 결과를 값으로 돌려주며 던지지 않는다.
 * 실패 결과에는 원문 오류를 싣지 않는다.
 */
export abstract class AdminNotifierPort {
  abstract send(
    channel: AdminNotificationChannel,
    notice: AdminNotice,
  ): Promise<AdminNotifyOutcome>;
}

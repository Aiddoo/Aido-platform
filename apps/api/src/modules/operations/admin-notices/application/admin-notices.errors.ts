import type { AdminNotificationChannel } from "../domain/admin-notices.constants.js";

/** 채널의 일시 실패(429·5xx·연결 실패)라 큐가 다시 시도하게 한다. HTTP로 나가지 않아 오류 코드가 없다 */
export class AdminNotificationRetryableError extends Error {
  constructor(channel: AdminNotificationChannel) {
    super(`Admin notification delivery failed: ${channel}`);
    this.name = AdminNotificationRetryableError.name;
  }
}

export function adminNotificationRetryable(
  channel: AdminNotificationChannel,
): AdminNotificationRetryableError {
  return new AdminNotificationRetryableError(channel);
}

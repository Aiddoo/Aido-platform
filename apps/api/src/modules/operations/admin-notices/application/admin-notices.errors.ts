import type { NotificationChannel } from "./ports/admin-notification-queue.port.js";

// 일시 실패라 큐가 다시 시도하게 하는 오류. HTTP로 나가지 않아 오류 코드가 없다
export function adminNotificationRetryable(channel: NotificationChannel): Error {
  const error = new Error(`Admin notification delivery failed: ${channel}`);
  error.name = "AdminNotificationRetryableError";
  return error;
}

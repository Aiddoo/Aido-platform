import { defineAlerts } from "#api/shared/application/alerts/define-alerts";

export const AdminNoticeAlerts = defineAlerts("operations", {
  ADMIN_NOTIFICATION_REJECTED: {
    key: "operations.admin-notification.rejected",
    severity: "warning",
    summary: "관리자 알림 채널이 재시도해도 소용없다고 거절했다",
    runbook: "태그 channel의 Discord webhook이 지워지거나 바뀌었는지 보고 env의 URL을 고친다.",
  },
});

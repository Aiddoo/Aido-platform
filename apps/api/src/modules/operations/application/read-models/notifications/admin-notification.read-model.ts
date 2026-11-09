export const ADMIN_NOTIFICATION_SEVERITIES = ["info", "success", "warning", "critical"] as const;

export type AdminNotificationSeverity = (typeof ADMIN_NOTIFICATION_SEVERITIES)[number];

export type AdminNotificationFieldValue =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "datetime"; readonly iso: string };

export interface AdminNotificationField {
  readonly label: string;
  readonly value: AdminNotificationFieldValue;
  readonly inline?: boolean;
}

/** 알림 채널(Discord·Slack 등)에 상관없는 관리자 알림 내용. 표시 형식은 어댑터가 정한다. */
export interface AdminNotification {
  readonly title: string;
  readonly body: string;
  readonly severity: AdminNotificationSeverity;
  readonly fields?: readonly AdminNotificationField[];
  readonly link?: string;
}

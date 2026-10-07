export const AdminNotificationInfraEvent = {
  PROVIDER_NOT_CONFIGURED: "operations.admin-notification.provider-not-configured",
  HTTP_FAILED: "operations.admin-notification.http-failed",
  REQUEST_FAILED: "operations.admin-notification.request-failed",
  JOB_STALLED: "operations.admin-notification.job-stalled",
  WORKER_FAILED: "operations.admin-notification.worker-failed",
  JOB_FAILED: "operations.admin-notification.job-failed",
  JOB_INVALID: "operations.admin-notification.job-invalid",
  SCHEDULE_REGISTERED: "operations.admin-notification.schedule-registered",
  SCHEDULE_FAILED: "operations.admin-notification.schedule-failed",
} as const;

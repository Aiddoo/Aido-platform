export const NotificationProviderLogEvent = {
  TICKET_FAILED: "notification.push_ticket_failed",
  TRANSPORT_FAILED: "notification.push_transport_failed",
  JOB_FAILED: "notification.job_failed",
  WORKER_FAILED: "notification.worker_failed",
  JOB_INVALID: "notification.job_invalid",
  JOB_STALLED: "notification.job_stalled",
  JOB_STARTED: "notification.job_started",
  JOB_SKIPPED: "notification.job_skipped",
  JOB_COMPLETED: "notification.job_completed",
  JOB_ENQUEUED: "notification.job_enqueued",
  SCHEDULE_REGISTERED: "notification.schedule_registered",
  ENQUEUE_FAILED: "notification.enqueue_failed",
} as const;

export function pushTransportStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error === null || !("statusCode" in error)) return undefined;
  const value = error.statusCode;
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}

export function pushTicketErrorCode(code: string): string {
  switch (code) {
    case "DeviceNotRegistered":
    case "MessageTooBig":
    case "MessageRateExceeded":
    case "MismatchSenderId":
    case "InvalidCredentials":
      return code;
    default:
      return "UNKNOWN";
  }
}

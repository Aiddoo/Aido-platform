export const NotificationProviderLogEvent = {
  TICKET_FAILED: "notification.push-ticket.failed",
  TRANSPORT_FAILED: "notification.push-transport.failed",
  JOB_FAILED: "notification.job.failed",
  WORKER_FAILED: "notification.worker.failed",
  JOB_INVALID: "notification.job.invalid",
  JOB_DEAD_LETTERED: "notification.job.dead-letter.sent",
  JOB_STALLED: "notification.job.stalled",
  JOB_STARTED: "notification.job.started",
  JOB_SKIPPED: "notification.job.skipped",
  TODO_REMINDER_DORMANT_OWNER_SKIPPED: "notification.todo-reminder.dormant-owner.skipped",
  TODO_SERIES_PAUSED_SENT: "notification.todo-series.paused-notice.sent",
  JOB_COMPLETED: "notification.job.completed",
  JOB_ENQUEUED: "notification.job.enqueued",
  SCHEDULE_REGISTERED: "notification.schedule.registered",
  ENQUEUE_FAILED: "notification.enqueue.failed",
} as const;

export function pushTransportStatusCode(error: unknown): number | undefined {
  if (typeof error !== "object" || error == null || !("statusCode" in error)) {
    return undefined;
  }
  const value = error.statusCode;
  return typeof value === "number" && Number.isInteger(value) && value >= 100 && value <= 599
    ? value
    : undefined;
}

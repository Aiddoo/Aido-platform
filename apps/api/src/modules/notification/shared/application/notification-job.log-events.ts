// 알림·리마인더 큐 작업이 함께 쓰는 키다. 키 하나는 앱 전체에서 한 뜻이라 두 slice가 같은 상수를 쓴다
export const NotificationJobLogEvent = {
  JOB_STARTED: "notification.job.started",
  JOB_SKIPPED: "notification.job.skipped",
  JOB_COMPLETED: "notification.job.completed",
  JOB_ENQUEUED: "notification.job.enqueued",
  JOB_DEAD_LETTERED: "notification.job.dead-letter.sent",
  ENQUEUE_FAILED: "notification.enqueue.failed",
  SCHEDULE_REGISTERED: "notification.schedule.registered",
} as const;

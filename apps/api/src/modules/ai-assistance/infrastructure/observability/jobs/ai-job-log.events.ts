export const AiJobLogEvent = {
  STALLED: "ai.job.stalled",
  FAILURE_RETENTION_DELEGATED: "ai.job.failure-retention.delegated",
  WORKER_FAILED: "ai.job.worker_failed",
  FAILED: "ai.job.failed",
  INVALID: "ai.job.invalid",
  STARTED: "ai.job.started",
  SKIPPED: "ai.job.skipped",
  COMPLETED: "ai.job.completed",
  SCHEDULED: "ai.job.scheduled",
  DISPATCH_STARTED: "ai.job.dispatch_started",
  DISPATCH_COMPLETED: "ai.job.dispatch_completed",
  CATCH_UP: "ai.job.catch_up",
} as const;

export const AiJobLogEvent = {
  FAILURE_RETENTION_DELEGATED: "ai.job.failure-retention.delegated",
  STARTED: "ai.job.started",
  SKIPPED: "ai.job.skipped",
  COMPLETED: "ai.job.completed",
  SCHEDULED: "ai.job.scheduled",
  DISPATCH_STARTED: "ai.job.dispatch_started",
  DISPATCH_COMPLETED: "ai.job.dispatch_completed",
  CATCH_UP: "ai.job.catch_up",
} as const;

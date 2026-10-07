export const OperationsNotificationsLogEvent = {
  SEND_STARTED: "operations.notifications.send.started",
  SEND_COMPLETED: "operations.notifications.send.completed",
  SIGNUP_ENQUEUE_FAILED: "operations.notifications.signup.enqueue-failed",
  SUBSCRIPTION_ENQUEUE_FAILED: "operations.notifications.subscription.enqueue-failed",
  SUMMARY_STARTED: "operations.notifications.summary.started",
  SUMMARY_ENQUEUED: "operations.notifications.summary.enqueued",
  SUMMARY_FAILED: "operations.notifications.summary.failed",
} as const;

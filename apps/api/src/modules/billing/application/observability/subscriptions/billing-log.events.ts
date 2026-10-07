export const BillingLogEvent = {
  WEBHOOK_INVALID: "billing.subscription.webhook.invalid",
  WEBHOOK_STARTED: "billing.subscription.webhook.started",
  WEBHOOK_LOCK_CONTENDED: "billing.subscription.webhook.lock.contended",
  WEBHOOK_FAILED: "billing.subscription.webhook.failed",
  WEBHOOK_IGNORED: "billing.subscription.webhook.ignored",
  WEBHOOK_DUPLICATE: "billing.subscription.webhook.duplicate",
  WEBHOOK_NO_CHANGE: "billing.subscription.webhook.no-change",
  WEBHOOK_COMPLETED: "billing.subscription.webhook.completed",
} as const;

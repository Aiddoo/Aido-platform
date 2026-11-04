export const EmailDeliveryLogEvent = {
  DELIVERY_QUEUED: "notification.email.delivery.queued",
  DELIVERY_REJECTED: "notification.email.delivery.rejected",
  DELIVERY_SENT: "notification.email.delivery.sent",
  DELIVERY_RETRY_SCHEDULED: "notification.email.delivery.retry-scheduled",
  DELIVERY_DROPPED: "notification.email.delivery.dropped",
  BUDGET_METER_FAILED: "notification.email.budget.meter-failed",
} as const;

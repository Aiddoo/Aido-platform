export const BroadcastLogEvent = {
  ACCEPTED: "operations.admin.broadcast.accepted",
  REPLAYED: "operations.admin.broadcast.replayed",
  COMPLETED: "operations.admin.broadcast.completed",
  CONTINUED: "operations.admin.broadcast.continued",
  FAILED: "operations.admin.broadcast.failed",
  DELIVERY_SCHEDULED: "operations.admin.broadcast.delivery.scheduled",
  DELIVERY_SENT: "operations.admin.broadcast.delivery.sent",
  DELIVERY_SKIPPED: "operations.admin.broadcast.delivery.skipped",
  TARGETED_COMPLETED: "operations.admin.targeted.completed",
} as const;

export const BroadcastLogEvent = {
  BROADCAST_ACCEPTED: "operations.admin.broadcast.accepted",
  BROADCAST_REPLAYED: "operations.admin.broadcast.replayed",
  BROADCAST_COMPLETED: "operations.admin.broadcast.completed",
  BROADCAST_CONTINUED: "operations.admin.broadcast.continued",
  BROADCAST_FAILED: "operations.admin.broadcast.failed",
  DELIVERY_SCHEDULED: "operations.admin.broadcast.delivery-scheduled",
  DELIVERY_SENT: "operations.admin.broadcast.delivery-sent",
  DELIVERY_SKIPPED: "operations.admin.broadcast.delivery-skipped",
  TARGETED_COMPLETED: "operations.admin.targeted.completed",
} as const;

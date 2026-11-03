export const PUSH_DISPATCH_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SENT",
  "SKIPPED",
  "FAILED",
  "HOLDOUT",
] as const;

export type PushDispatchStatus = (typeof PUSH_DISPATCH_STATUSES)[number];

export const PUSH_DELIVERY_ATTEMPT_STATUSES = [
  "PENDING",
  "TICKET_ACCEPTED",
  "DELIVERED",
  "FAILED",
  "UNKNOWN",
] as const;

export type PushDeliveryAttemptStatus = (typeof PUSH_DELIVERY_ATTEMPT_STATUSES)[number];

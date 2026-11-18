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

export const PUSH_DELIVERY_MODES = ["SINGLE", "BATCH"] as const;

export type PushDeliveryMode = (typeof PUSH_DELIVERY_MODES)[number];

export const PUSH_DISPATCH_OUTBOX_STATUSES = ["PENDING", "PROCESSING", "PUBLISHED"] as const;

// 거래성과 참여 알림이 서로의 발송 한도를 쓰지 않게 나눈다
export const PUSH_RATE_LIMIT_PHASES = ["GENERAL", "ENGAGEMENT"] as const;

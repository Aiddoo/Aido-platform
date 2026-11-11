/** 원장 이벤트. 필드는 chargeId·meter·reason(·plan)만 남기고 사용자 내용은 남기지 않는다. */
export const QuotaLogEvent = {
  RESERVED: "access.quota.reserved",
  COMMITTED: "access.quota.committed",
  REFUNDED: "access.quota.refunded",
  EXHAUSTED: "access.quota.exhausted",
  IN_FLIGHT: "access.quota.in-flight",
  KEY_REUSED: "access.quota.key-reused",
  COMMIT_FAILED: "access.quota.commit-failed",
  REFUND_FAILED: "access.quota.refund-failed",
  ABANDONED_REFUND_COMPLETED: "access.quota.abandoned-refund.completed",
  ABANDONED_REFUND_FAILED: "access.quota.abandoned-refund.failed",
  REOPENED: "access.quota.reopened",
} as const;

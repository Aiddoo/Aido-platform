export const PremiumGrantLogEvent = {
  RECORDED: "billing.premium-grant.recorded",
  SWEPT: "billing.premium-grant.swept",
  LAPSED_PREMIUM_SWEPT: "billing.premium-access.lapsed.swept",
  REVOKED: "billing.premium-grant.revoked",
  RECONCILE_FAILED: "billing.premium-grant.reconcile.failed",
  CACHE_INVALIDATION_FAILED: "billing.premium-grant.cache-invalidation.failed",
  ENDING_NOTIFIED: "billing.premium-grant.ending.notified",
} as const;

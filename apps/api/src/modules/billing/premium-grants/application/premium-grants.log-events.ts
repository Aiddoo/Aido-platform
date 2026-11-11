export const PremiumGrantLogEvent = {
  PREMIUM_GRANT_RECORDED: "billing.premium-grant.recorded",
  PREMIUM_GRANT_SWEPT: "billing.premium-grant.swept",
  LAPSED_PREMIUM_SWEPT: "billing.premium-access.lapsed.swept",
  PREMIUM_GRANT_REVOKED: "billing.premium-grant.revoked",
  PREMIUM_GRANT_RECONCILE_FAILED: "billing.premium-grant.reconcile.failed",
  PREMIUM_GRANT_CACHE_INVALIDATION_FAILED: "billing.premium-grant.cache-invalidation.failed",
  PREMIUM_GRANT_ENDING_NOTIFIED: "billing.premium-grant.ending.notified",
  PREMIUM_GRANT_SWEEP_STEP_FAILED: "billing.premium-grant.sweep.step.failed",
  PREMIUM_GRANT_SWEEP_SCHEDULER_REGISTERED: "billing.premium-grant.sweep.scheduler.registered",
  PREMIUM_GRANT_SWEEP_JOB_FAILED: "billing.premium-grant.sweep.job.failed",
} as const;

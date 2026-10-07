export const NotificationRetentionLogEvent = {
  DISPATCH_RETENTION_PUSH_CACHE_SETTLE_FAILED:
    "notification.retention.dispatch-retention-push.cache-settle-failed",
  DISPATCH_RETENTION_PUSH_CLAIM_RECOVERY_FAILED:
    "notification.retention.dispatch-retention-push.claim-recovery-failed",
  PROCESS_RETENTION_STAGES_STAGE_FAILED:
    "notification.retention.process-retention-stages.stage-failed",
  PROCESS_RETENTION_STAGES_STAGE_PROCESSED:
    "notification.retention.process-retention-stages.stage-processed",
  RELAY_RETENTION_OUTBOX_PUBLICATION_FAILED:
    "notification.retention.relay-retention-outbox.publication-failed",
  RELAY_RETENTION_OUTBOX_PUBLISHED_STATE_FAILED:
    "notification.retention.relay-retention-outbox.published-state-failed",
} as const;

export const NotificationLogEvent = {
  MARKETING_CONSENT_RECONFIRMED: "notification.delivery.marketing-consent-reconfirm.completed",
  MARKETING_CONSENT_RECONFIRM_SCHEDULER_REGISTERED:
    "notification.delivery.marketing-consent-reconfirm.scheduler.registered",
  MARKETING_CONSENT_RECONFIRM_JOB_FAILED:
    "notification.delivery.marketing-consent-reconfirm.job.failed",
  NOTIFICATION_HISTORY_WARM_UP_FAILED: "notification.delivery.notification-history.warm-up.failed",
  NOTIFICATION_HISTORY_PURGED: "notification.delivery.notification-history.purged",
  NOTIFICATION_HISTORY_PURGE_JOB_FAILED:
    "notification.delivery.notification-history-purge.job.failed",
  NOTIFICATION_HISTORY_PURGE_UNREAD_CACHE_FAILED:
    "notification.delivery.notification-history-purge.unread-cache.failed",
  NOTIFICATION_HISTORY_PURGE_SCHEDULER_REGISTERED:
    "notification.delivery.notification-history-purge.scheduler.registered",
  NOTIFICATION_ACCOUNT_CLEANUP_CACHE_SETTLE_FAILED:
    "notification.delivery.notification-account-cleanup.cache-settle.failed",
  FINALIZE_BATCH_NOTIFICATION_UNREAD_CACHE_FAILED:
    "notification.delivery.finalize-batch-notification.unread-cache.failed",
  FINALIZE_BATCH_NOTIFICATION_DEDUPLICATION_RECORD_FAILED:
    "notification.delivery.finalize-batch-notification.dedup-record.failed",
  GET_NOTIFICATIONS_LISTED: "notification.delivery.get-notifications.listed",
  MARK_ALL_AS_READ_READ_ALL_PROCESSED: "notification.delivery.mark-all-as-read.read-all.processed",
  MARK_AS_READ_READ_PROCESSED: "notification.delivery.mark-as-read.read.processed",
  PUSH_OPENED: "notification.push.opened",
  SEND_BILLING_ISSUE_NOTIFICATION_SENT:
    "notification.delivery.send-billing-issue-notification.sent",
  SEND_CHEER_NOTIFICATION_SENT: "notification.delivery.send-cheer-notification.sent",
  SEND_FOLLOW_ACCEPTED_NOTIFICATION_SENT:
    "notification.delivery.send-follow-accepted-notification.sent",
  SEND_FOLLOW_REQUEST_NOTIFICATION_SENT:
    "notification.delivery.send-follow-request-notification.sent",
  SEND_FRIEND_COMPLETION_NOTIFICATIONS_NO_RECIPIENTS:
    "notification.delivery.send-friend-completion-notifications.recipients.missing",
  SEND_FRIEND_COMPLETION_NOTIFICATIONS_ALREADY_SENT:
    "notification.delivery.send-friend-completion-notifications.already.sent",
  SEND_FRIEND_COMPLETION_NOTIFICATIONS_DUPLICATE_PREVENTED:
    "notification.delivery.send-friend-completion-notifications.duplicate.prevented",
  SEND_FRIEND_COMPLETION_NOTIFICATIONS_PERSISTED:
    "notification.delivery.send-friend-completion-notifications.persisted",
  SEND_FRIEND_COMPLETION_NOTIFICATIONS_EFFECTS_FINALIZED:
    "notification.delivery.send-friend-completion-notifications.effects.finalized",
  SEND_MILESTONE_NOTIFICATION_DUPLICATE_SKIPPED:
    "notification.delivery.send-milestone-notification.duplicate.skipped",
  SEND_MILESTONE_NOTIFICATION_SENT: "notification.delivery.send-milestone-notification.sent",
  SEND_NOTIFICATION_WITH_DEDUPLICATION_DUPLICATE_SKIPPED:
    "notification.delivery.send-notification-with-dedup.duplicate.skipped",
  SEND_NOTIFICATION_DUPLICATE_PREVENTED:
    "notification.delivery.send-notification.duplicate.prevented",
  SEND_NOTIFICATION_UNREAD_CACHE_FAILED:
    "notification.delivery.send-notification.unread-cache.failed",
  SEND_NUDGE_NOTIFICATION_SENT: "notification.delivery.send-nudge-notification.sent",
} as const;

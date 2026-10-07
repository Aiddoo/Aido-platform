export const NotificationDeliveryLogEvent = {
  RECONCILE_PUSH_RECEIPTS_CACHE_SETTLE_FAILED:
    "notification.delivery.reconcile-push-receipts.cache-settle-failed",
  NOTIFICATION_HISTORY_WARM_UP_FAILED: "notification.delivery.notification-history.warm-up-failed",
  NOTIFICATION_ACCOUNT_CLEANUP_CACHE_SETTLE_FAILED:
    "notification.delivery.notification-account-cleanup.cache-settle-failed",
  PUSH_DELIVERY_AFTER_COMMIT_FAST_PATH_UNSETTLED:
    "notification.delivery.push-delivery-after-commit.fast-path-unsettled",
  PUSH_NOTIFICATION_DELIVERY_INVALID_TOKENS_DEACTIVATED:
    "notification.delivery.push-notification-delivery.invalid-tokens-deactivated",
  PUSH_NOTIFICATION_DELIVERY_SINGLE_SENT:
    "notification.delivery.push-notification-delivery.single-sent",
  PUSH_NOTIFICATION_DELIVERY_BATCH_INVALID_TOKENS_DEACTIVATED:
    "notification.delivery.push-notification-delivery.batch-invalid-tokens-deactivated",
  PUSH_NOTIFICATION_DELIVERY_BATCH_SENT:
    "notification.delivery.push-notification-delivery.batch-sent",
  DELIVER_PUSH_NOTIFICATIONS_CLAIM_RECOVERY_FAILED:
    "notification.delivery.deliver-push-notifications.claim-recovery-failed",
  DELIVER_PUSH_NOTIFICATIONS_DISPATCH_SKIPPED:
    "notification.delivery.deliver-push-notifications.dispatch-skipped",
  DELIVER_PUSH_NOTIFICATIONS_LEASE_RELEASE_FAILED:
    "notification.delivery.deliver-push-notifications.lease-release-failed",
  FINALIZE_BATCH_NOTIFICATION_UNREAD_CACHE_FAILED:
    "notification.delivery.finalize-batch-notification.unread-cache-failed",
  FINALIZE_BATCH_NOTIFICATION_DEDUP_RECORD_FAILED:
    "notification.delivery.finalize-batch-notification.dedup-record-failed",
  GET_NOTIFICATIONS_LISTED: "notification.delivery.get-notifications.listed",
  MARK_ALL_AS_READ_READ_ALL_PROCESSED: "notification.delivery.mark-all-as-read.read-all-processed",
  MARK_AS_READ_READ_PROCESSED: "notification.delivery.mark-as-read.read-processed",
  MARK_NOTIFICATION_OPENED_OPENED: "notification.delivery.mark-notification-opened.opened",
  OPT_OUT_MARKETING_PUSH_OPTED_OUT: "notification.delivery.opt-out-marketing-push.opted-out",
  PUBLISH_PUSH_DELIVERY_OUTBOX_ENQUEUE_DEFERRED:
    "notification.delivery.publish-push-delivery-outbox.enqueue-deferred",
  PUBLISH_PUSH_DELIVERY_OUTBOX_PUBLISH_MARK_FAILED:
    "notification.delivery.publish-push-delivery-outbox.publish-mark-failed",
  RECONCILE_PUSH_RECEIPTS_RECONCILED: "notification.delivery.reconcile-push-receipts.reconciled",
  REGISTER_PUSH_TOKEN_REGISTERED: "notification.delivery.register-push-token.registered",
  SEND_BILLING_ISSUE_NOTIFICATION_SENT:
    "notification.delivery.send-billing-issue-notification.sent",
  SEND_CHEER_NOTIFICATION_SENT: "notification.delivery.send-cheer-notification.sent",
  SEND_FOLLOW_ACCEPTED_NOTIFICATION_SENT:
    "notification.delivery.send-follow-accepted-notification.sent",
  SEND_FOLLOW_REQUEST_NOTIFICATION_SENT:
    "notification.delivery.send-follow-request-notification.sent",
  SEND_FRIEND_COMPLETION_NOTIFICATIONS_NO_RECIPIENTS:
    "notification.delivery.send-friend-completion-notifications.no-recipients",
  SEND_FRIEND_COMPLETION_NOTIFICATIONS_ALREADY_SENT:
    "notification.delivery.send-friend-completion-notifications.already-sent",
  SEND_FRIEND_COMPLETION_NOTIFICATIONS_DUPLICATE_PREVENTED:
    "notification.delivery.send-friend-completion-notifications.duplicate-prevented",
  SEND_FRIEND_COMPLETION_NOTIFICATIONS_PERSISTED:
    "notification.delivery.send-friend-completion-notifications.persisted",
  SEND_FRIEND_COMPLETION_NOTIFICATIONS_EFFECTS_FINALIZED:
    "notification.delivery.send-friend-completion-notifications.effects-finalized",
  SEND_MILESTONE_NOTIFICATION_LOCK_BUSY:
    "notification.delivery.send-milestone-notification.lock-busy",
  SEND_MILESTONE_NOTIFICATION_DUPLICATE_SKIPPED:
    "notification.delivery.send-milestone-notification.duplicate-skipped",
  SEND_MILESTONE_NOTIFICATION_SENT: "notification.delivery.send-milestone-notification.sent",
  SEND_NOTIFICATION_WITH_DEDUP_LOCK_BUSY:
    "notification.delivery.send-notification-with-dedup.lock-busy",
  SEND_NOTIFICATION_WITH_DEDUP_DUPLICATE_SKIPPED:
    "notification.delivery.send-notification-with-dedup.duplicate-skipped",
  SEND_NOTIFICATION_DUPLICATE_PREVENTED:
    "notification.delivery.send-notification.duplicate-prevented",
  SEND_NOTIFICATION_UNREAD_CACHE_FAILED:
    "notification.delivery.send-notification.unread-cache-failed",
  SEND_NUDGE_NOTIFICATION_SENT: "notification.delivery.send-nudge-notification.sent",
  UNREGISTER_PUSH_TOKEN_UNREGISTERED: "notification.delivery.unregister-push-token.unregistered",
  UNREGISTER_PUSH_TOKEN_NOT_FOUND: "notification.delivery.unregister-push-token.not-found",
  UNREGISTER_PUSH_TOKEN_ALL_UNREGISTERED:
    "notification.delivery.unregister-push-token.all-unregistered",
} as const;

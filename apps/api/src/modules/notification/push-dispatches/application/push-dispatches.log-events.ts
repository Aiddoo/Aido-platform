export const PushDispatchLogEvent = {
  RECONCILE_PUSH_RECEIPTS_CACHE_SETTLE_FAILED:
    "notification.delivery.reconcile-push-receipts.cache-settle.failed",
  PUSH_DELIVERY_AFTER_COMMIT_FAST_PATH_UNSETTLED:
    "notification.delivery.push-delivery-after-commit.fast-path.unsettled",
  PUSH_NOTIFICATION_DELIVERY_INVALID_TOKENS_DEACTIVATED:
    "notification.delivery.push-notification-delivery.invalid-tokens.deactivated",
  PUSH_NOTIFICATION_DELIVERY_SINGLE_SENT:
    "notification.delivery.push-notification-delivery.single.sent",
  PUSH_NOTIFICATION_DELIVERY_BATCH_INVALID_TOKENS_DEACTIVATED:
    "notification.delivery.push-notification-delivery.batch-invalid-tokens.deactivated",
  PUSH_NOTIFICATION_DELIVERY_BATCH_SENT:
    "notification.delivery.push-notification-delivery.batch.sent",
  DELIVER_PUSH_NOTIFICATIONS_CLAIM_RECOVERY_FAILED:
    "notification.delivery.deliver-push-notifications.claim-recovery.failed",
  DELIVER_PUSH_NOTIFICATIONS_DISPATCH_SKIPPED:
    "notification.delivery.deliver-push-notifications.dispatch.skipped",
  DELIVER_PUSH_NOTIFICATIONS_LEASE_RELEASE_FAILED:
    "notification.delivery.deliver-push-notifications.lease-release.failed",
  OPT_OUT_MARKETING_PUSH_OPTED_OUT: "notification.delivery.marketing-push.unsubscribed",
  PUBLISH_PUSH_DELIVERY_OUTBOX_ENQUEUE_DEFERRED:
    "notification.delivery.publish-push-delivery-outbox.enqueue.deferred",
  PUBLISH_PUSH_DELIVERY_OUTBOX_PUBLISH_MARK_FAILED:
    "notification.delivery.publish-push-delivery-outbox.publish-mark.failed",
  RECONCILE_PUSH_RECEIPTS_RECONCILED: "notification.delivery.reconcile-push-receipts.reconciled",
} as const;

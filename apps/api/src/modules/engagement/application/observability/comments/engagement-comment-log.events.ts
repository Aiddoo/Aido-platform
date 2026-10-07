export const EngagementCommentLogEvent = {
  VIEW_CACHE_INVALIDATION_FAILED: "engagement.comment.view-cache.invalidation.failed",
  WRITE_NOTIFICATION_FAILED: "engagement.comment.write.notification.failed",
  LIKE_NOTIFICATION_FAILED: "engagement.comment.like.notification.failed",
  ACCOUNT_CLEANUP_CACHE_INVALIDATION_FAILED:
    "engagement.comment.account-cleanup.cache.invalidation.failed",
} as const;

export type EngagementCommentFailureEvent =
  (typeof EngagementCommentLogEvent)[keyof typeof EngagementCommentLogEvent];

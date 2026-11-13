import type { ApplicationLoggerPort } from "#api/shared/application/ports/application-logger.port";

export const TodoCommentLogEvent = {
  VIEW_CACHE_INVALIDATION_FAILED: "engagement.comment.view-cache.invalidation.failed",
  WRITE_NOTIFICATION_FAILED: "engagement.comment.write.notification.failed",
  LIKE_NOTIFICATION_FAILED: "engagement.comment.like.notification.failed",
  ACCOUNT_CLEANUP_CACHE_INVALIDATION_FAILED:
    "engagement.comment.account-cleanup.cache.invalidation.failed",
} as const;

type TodoCommentFailureEvent = (typeof TodoCommentLogEvent)[keyof typeof TodoCommentLogEvent];

interface AfterCommitTask {
  readonly failureEvent: TodoCommentFailureEvent;
  readonly context:
    | {
        readonly todoId: number;
        readonly commentId?: string;
        readonly userId?: string;
      }
    | { readonly todoCount: number };
  readonly run: () => Promise<unknown>;
}

/** 커밋된 쓰기를 부수 작업 실패 때문에 실패 응답으로 바꾸지 않는다. */
export async function settleAfterCommit(
  logger: ApplicationLoggerPort,
  tasks: readonly AfterCommitTask[],
): Promise<void> {
  const settled = await Promise.allSettled(
    tasks.map((task) => Promise.resolve().then(() => task.run())),
  );

  for (const [index, task] of tasks.entries()) {
    const result = settled[index];
    if (result?.status === "rejected") {
      logger.warn({
        event: task.failureEvent,
        ...task.context,
        errorType: result.reason instanceof Error ? result.reason.name : "UnknownError",
      });
    }
  }
}

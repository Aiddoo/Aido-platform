import type { ApplicationLogger } from "#api/shared/application/ports/application-logger";

import type { EngagementCommentFailureEvent } from "../../observability/comments/engagement-comment-log.events.js";

interface AfterCommitTask {
  readonly failureEvent: EngagementCommentFailureEvent;
  readonly context: {
    readonly todoId: number;
    readonly commentId?: string;
    readonly userId?: string;
  };
  readonly run: () => Promise<unknown>;
}

/** 커밋된 쓰기를 부수 작업 실패 때문에 실패 응답으로 바꾸지 않는다. */
export async function settleAfterCommit(
  logger: ApplicationLogger,
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

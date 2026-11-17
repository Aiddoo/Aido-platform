import {
  type TodoCommentActivityNotificationInput,
  TodoCommentNotificationPort,
  type TodoCommentWrittenInput,
} from "#api/modules/engagement/todo-comments/application/ports/todo-comment-notification.port";

/** 받은 알림을 id 값으로 풀어 기록한다. 테스트가 문자열·숫자로 바로 비교한다 */
interface RecordedActivityNotification {
  readonly recipientId: string;
  readonly senderId: string;
  readonly senderName: string | null;
  readonly todoId: number;
  readonly commentId: string;
  readonly threadRootId: string;
}

interface RecordedWrittenNotification extends RecordedActivityNotification {
  readonly replyTarget: TodoCommentWrittenInput["replyTarget"];
  readonly commentCount: number;
}

function toRecordedActivity(
  input: TodoCommentActivityNotificationInput,
): RecordedActivityNotification {
  return {
    recipientId: input.recipientId.value,
    senderId: input.senderId.value,
    senderName: input.senderName,
    todoId: input.todoId.value,
    commentId: input.commentId.value,
    threadRootId: input.threadRootId.value,
  };
}

export class RecordingTodoCommentNotification extends TodoCommentNotificationPort {
  readonly written: RecordedWrittenNotification[] = [];
  readonly liked: RecordedActivityNotification[] = [];
  /** 다음 발송을 이 오류로 실패시킨다 */
  failure: Error | null = null;

  async notifyCommentsWritten(input: TodoCommentWrittenInput): Promise<void> {
    this.#throwIfFailing();
    this.written.push({
      ...toRecordedActivity(input),
      replyTarget: input.replyTarget,
      commentCount: input.commentCount,
    });
  }

  async notifyCommentLiked(input: TodoCommentActivityNotificationInput): Promise<void> {
    this.#throwIfFailing();
    this.liked.push(toRecordedActivity(input));
  }

  #throwIfFailing(): void {
    const failure = this.failure;
    if (failure != null) {
      this.failure = null;
      throw failure;
    }
  }
}

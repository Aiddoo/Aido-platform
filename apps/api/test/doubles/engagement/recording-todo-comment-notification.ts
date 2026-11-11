import {
  type TodoCommentActivityNotificationInput,
  TodoCommentNotificationPort,
  type TodoCommentWrittenInput,
} from "#api/modules/engagement/comments/application/ports/todo-comment-notification.port";

export class RecordingTodoCommentNotification extends TodoCommentNotificationPort {
  readonly written: TodoCommentWrittenInput[] = [];
  readonly liked: TodoCommentActivityNotificationInput[] = [];
  /** 다음 발송을 이 오류로 실패시킨다 */
  failure: Error | null = null;

  async notifyCommentsWritten(input: TodoCommentWrittenInput): Promise<void> {
    this.#throwIfFailing();
    this.written.push(structuredClone(input));
  }

  async notifyCommentLiked(input: TodoCommentActivityNotificationInput): Promise<void> {
    this.#throwIfFailing();
    this.liked.push(structuredClone(input));
  }

  #throwIfFailing(): void {
    const failure = this.failure;
    if (failure != null) {
      this.failure = null;
      throw failure;
    }
  }
}

import { todoCommentNotificationRoutingSchema } from "@aido/api/contracts/notification";
import { NOTIFICATION_ACTION_TYPE } from "@aido/api/vocabulary";
import { Inject, Injectable } from "@nestjs/common";

import {
  createTodoCommentNotificationMessage,
  NotificationPublisher,
  NotificationRecipientLocaleReaderPort,
  TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY,
} from "#api/modules/notification/notification-delivery.public";
import { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import {
  type TodoCommentActivityNotificationInput,
  TodoCommentNotificationPort,
  type TodoCommentWrittenInput,
} from "../../application/ports/todo-comment-notification.port.js";

type TodoCommentNotificationCopyInput = Parameters<typeof createTodoCommentNotificationMessage>[0];
// 문구 입력에서 받는 사람·문맥 칸을 뺀 활동 부분. 종류 목록은 notification 문구가 소유한다
type TodoCommentNotificationActivity = TodoCommentNotificationCopyInput extends infer Input
  ? Input extends unknown
    ? Omit<Input, "senderName" | "locale" | "variantContext">
    : never
  : never;

@Injectable()
export class TodoCommentNotificationAdapter implements TodoCommentNotificationPort {
  readonly #notificationPublisher: NotificationPublisher;
  readonly #recipientLocaleReader: NotificationRecipientLocaleReaderPort;

  constructor(
    notificationPublisher: NotificationPublisher,
    @Inject(NotificationRecipientLocaleReaderPort)
    recipientLocaleReader: NotificationRecipientLocaleReaderPort,
  ) {
    this.#notificationPublisher = notificationPublisher;
    this.#recipientLocaleReader = recipientLocaleReader;
  }

  notifyCommentsWritten(input: TodoCommentWrittenInput): Promise<void> {
    const activity: TodoCommentNotificationActivity =
      input.replyTarget == null
        ? { activityKind: "COMMENT", commentCount: input.commentCount }
        : {
            activityKind: "REPLY",
            commentCount: input.commentCount,
            replyTarget: input.replyTarget,
          };

    return this.#sendActivityNotification(input, activity);
  }

  notifyCommentLiked(input: TodoCommentActivityNotificationInput): Promise<void> {
    return this.#sendActivityNotification(input, { activityKind: "LIKE" });
  }

  /**
   * 알림 타입은 TODO_SHARED 그대로 둔다 — 새 타입을 늘리면 구버전 앱의 목록 파싱이 통째로 깨진다.
   * 무엇에 달렸는지는 문구와 activityKind가 말한다.
   */
  async #sendActivityNotification(
    input: TodoCommentActivityNotificationInput,
    activity: TodoCommentNotificationActivity,
  ): Promise<void> {
    if (input.recipientId === input.senderId) {
      return;
    }

    const locale = await this.#recipientLocaleReader.getLocale(
      UserId.reconstitute(input.recipientId),
    );
    const variantContext = {
      campaignKey: TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY.TODO_COMMENT_ACTIVITY,
      recipientId: input.recipientId,
      occurrenceKey:
        activity.activityKind === "LIKE" ? `${input.commentId}:${input.senderId}` : input.commentId,
    };
    const copy = createTodoCommentNotificationMessage({
      ...activity,
      senderName: input.senderName,
      locale,
      variantContext,
    });
    const routing = todoCommentNotificationRoutingSchema.parse({
      commentId: input.commentId,
      threadRootId: input.threadRootId,
      activityKind: activity.activityKind,
    });
    await this.#notificationPublisher.publish({
      userId: input.recipientId,
      type: "TODO_SHARED",
      title: copy.title,
      body: copy.body,
      todoId: input.todoId,
      action: {
        type: NOTIFICATION_ACTION_TYPE.DEEP_LINK,
      },
      metadata: {
        senderId: input.senderId,
        ...routing,
      },
      campaignKey: variantContext.campaignKey,
      variantId: copy.variantId,
    });
  }
}

import { todoCommentNotificationRoutingSchema, NOTIFICATION_ACTION_TYPE } from "@aido/api";
import type { TodoCommentKind } from "@aido/api/vocabulary";
import { Inject, Injectable } from "@nestjs/common";

import {
  createTodoCommentNotificationMessage,
  NotificationPublisher,
  NOTIFICATION_RECIPIENT_LOCALE_READER,
  type NotificationRecipientLocaleReaderPort,
  TRANSACTIONAL_NOTIFICATION_CAMPAIGN_KEY,
} from "#api/modules/notification/notification-delivery.public";

import type {
  TodoCommentActivityNotificationInput,
  TodoCommentNotificationPort,
  TodoCommentWrittenInput,
} from "../../application/ports/todo-comment-notification.port.js";

type TodoCommentNotificationActivity =
  | { readonly activityKind: "COMMENT"; readonly commentCount: number }
  | {
      readonly activityKind: "REPLY";
      readonly commentCount: number;
      readonly replyTarget: TodoCommentKind;
    }
  | { readonly activityKind: "LIKE" };

@Injectable()
export class TodoCommentNotificationAdapter implements TodoCommentNotificationPort {
  readonly #notificationPublisher: NotificationPublisher;
  readonly #recipientLocaleReader: NotificationRecipientLocaleReaderPort;

  constructor(
    notificationPublisher: NotificationPublisher,
    @Inject(NOTIFICATION_RECIPIENT_LOCALE_READER)
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

    const locale = await this.#recipientLocaleReader.getLocale(input.recipientId);
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

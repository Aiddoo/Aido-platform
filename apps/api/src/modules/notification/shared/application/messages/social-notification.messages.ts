import type { NudgeReplyKind, TodoCommentKind } from "@aido/api/vocabulary";

import { DEFAULT_LOCALE, type SupportedLocale } from "#api/shared/domain/locale";

import type {
  NotificationMessage,
  NotificationVariantContext,
} from "./notification-copy-catalog.messages.js";
import { SOCIAL_COPY } from "./notification-copy-templates.messages.js";
import {
  notificationFriendFallback,
  renderNotificationTemplate,
  toNameFact,
} from "./notification-copy.messages.js";

/** 친구 이름이 없을 때에도 사용자 언어에 맞는 중립적인 라벨을 쓴다. */
export function getNotificationFriendFallback(locale: SupportedLocale = DEFAULT_LOCALE): string {
  return notificationFriendFallback(locale);
}

interface LocalizedVariantInput {
  readonly locale?: SupportedLocale;
  readonly variantContext?: NotificationVariantContext;
}

interface SenderNotificationInput extends LocalizedVariantInput {
  readonly senderName: string;
}

export function createNudgeReplyNotificationMessage(
  input: SenderNotificationInput & {
    readonly todoTitle: string;
    readonly replyKind: NudgeReplyKind;
  },
): NotificationMessage {
  const locale = input.locale ?? DEFAULT_LOCALE;
  return renderNotificationTemplate(SOCIAL_COPY.NUDGE_REPLIED, {
    facts: {
      senderName: toNameFact(input.senderName, locale),
      todoTitle: input.todoTitle,
      replyKind: input.replyKind,
    },
    locale,
    variantContext: input.variantContext,
    templateKey: "nudge.reply",
  });
}

export function createNudgeThanksNotificationMessage(
  input: SenderNotificationInput & {
    readonly todoTitle: string;
  },
): NotificationMessage {
  const locale = input.locale ?? DEFAULT_LOCALE;
  return renderNotificationTemplate(SOCIAL_COPY.NUDGE_THANKED, {
    facts: { senderName: toNameFact(input.senderName, locale), todoTitle: input.todoTitle },
    locale,
    variantContext: input.variantContext,
    templateKey: "nudge.thanks",
  });
}

export interface FollowRequestNotificationInput extends SenderNotificationInput {}
export interface FollowAcceptedNotificationInput extends SenderNotificationInput {}

export interface NudgeReceivedNotificationInput extends SenderNotificationInput {
  readonly todoTitle?: string;
  /** 사용자가 작성한 원문. 템플릿 문법으로 다시 해석하지 않는다. */
  readonly message?: string;
}

export interface TodoCreationNudgeNotificationInput extends SenderNotificationInput {
  /** 사용자가 작성한 원문. 템플릿 문법으로 다시 해석하지 않는다. */
  readonly message?: string;
}

export interface CheerReceivedNotificationInput extends SenderNotificationInput {
  /** 사용자가 작성한 원문. 템플릿 문법으로 다시 해석하지 않는다. */
  readonly message?: string;
}

export interface FriendCompletedNotificationInput extends LocalizedVariantInput {
  readonly friendName: string;
}

interface TodoCommentNotificationBase extends LocalizedVariantInput {
  readonly senderName: string | null;
}

export type TodoCommentNotificationCopyInput =
  | (TodoCommentNotificationBase & {
      readonly activityKind: "COMMENT";
      readonly commentCount: number;
    })
  | (TodoCommentNotificationBase & {
      readonly activityKind: "REPLY";
      readonly commentCount: number;
      /** 답한 글이 답글이면 "내 답글에"로 말한다 */
      readonly replyTarget: TodoCommentKind;
    })
  | (TodoCommentNotificationBase & {
      readonly activityKind: "LIKE";
      readonly commentCount?: never;
    });

export function createFollowRequestNotificationMessage({
  senderName,
  locale = DEFAULT_LOCALE,
  variantContext,
}: FollowRequestNotificationInput): NotificationMessage {
  return renderNotificationTemplate(SOCIAL_COPY.FOLLOW_NEW, {
    facts: { senderName: toNameFact(senderName, locale) },
    locale,
    variantContext,
    templateKey: "follow.request",
  });
}

export function createFollowAcceptedNotificationMessage({
  senderName,
  locale = DEFAULT_LOCALE,
  variantContext,
}: FollowAcceptedNotificationInput): NotificationMessage {
  return renderNotificationTemplate(SOCIAL_COPY.FOLLOW_ACCEPTED, {
    facts: { senderName: toNameFact(senderName, locale) },
    locale,
    variantContext,
    templateKey: "follow.accepted",
  });
}

export interface InviteJoinedNotificationInput extends LocalizedVariantInput {
  readonly inviteeName: string;
}

export function createInviteJoinedNotificationMessage({
  inviteeName,
  locale = DEFAULT_LOCALE,
  variantContext,
}: InviteJoinedNotificationInput): NotificationMessage {
  return renderNotificationTemplate(SOCIAL_COPY.INVITE_JOINED, {
    facts: { inviteeName: toNameFact(inviteeName, locale) },
    locale,
    variantContext,
    templateKey: "invite.joined",
  });
}

export interface InviteProgressNotificationInput extends LocalizedVariantInput {
  readonly inviteeName: string;
}

export function createInviteProgressNotificationMessage({
  inviteeName,
  locale = DEFAULT_LOCALE,
  variantContext,
}: InviteProgressNotificationInput): NotificationMessage {
  return renderNotificationTemplate(SOCIAL_COPY.INVITE_PROGRESS, {
    facts: { inviteeName: toNameFact(inviteeName, locale) },
    locale,
    variantContext,
    templateKey: "invite.progress",
  });
}

export interface InviteQualifyReminderNotificationInput extends LocalizedVariantInput {
  readonly inviterName: string;
}

export function createInviteQualifyReminderNotificationMessage({
  inviterName,
  locale = DEFAULT_LOCALE,
  variantContext,
}: InviteQualifyReminderNotificationInput): NotificationMessage {
  return renderNotificationTemplate(SOCIAL_COPY.INVITE_QUALIFY_REMINDER, {
    facts: { inviterName: toNameFact(inviterName, locale) },
    locale,
    variantContext,
    templateKey: "invite.qualify-reminder",
  });
}

export interface InviteRewardedNotificationInput extends LocalizedVariantInput {
  readonly premiumDays: number;
  readonly friendSlots: number;
}

export function createInviteRewardedNotificationMessage({
  premiumDays,
  friendSlots,
  locale = DEFAULT_LOCALE,
  variantContext,
}: InviteRewardedNotificationInput): NotificationMessage {
  return renderNotificationTemplate(SOCIAL_COPY.INVITE_REWARDED, {
    facts: { premiumDays, friendSlots },
    locale,
    variantContext,
    templateKey: "invite.rewarded",
  });
}

export function createNudgeReceivedNotificationMessage({
  senderName,
  todoTitle,
  message,
  locale = DEFAULT_LOCALE,
  variantContext,
}: NudgeReceivedNotificationInput): NotificationMessage {
  const facts = { senderName: toNameFact(senderName, locale), todoTitle: todoTitle || null };

  if (message) {
    return renderNotificationTemplate(SOCIAL_COPY.NUDGE_RECEIVED_WITH_MESSAGE, {
      facts: { ...facts, message },
      locale,
      variantContext,
      templateKey: "nudge.message",
    });
  }

  return renderNotificationTemplate(SOCIAL_COPY.NUDGE_RECEIVED, {
    facts,
    locale,
    variantContext,
    templateKey: "nudge.standard",
  });
}

export function createTodoCreationNudgeNotificationMessage({
  senderName,
  message,
  locale = DEFAULT_LOCALE,
  variantContext,
}: TodoCreationNudgeNotificationInput): NotificationMessage {
  if (message) {
    return renderNotificationTemplate(SOCIAL_COPY.REMIND_NUDGE_RECEIVED_WITH_MESSAGE, {
      facts: { senderName: toNameFact(senderName, locale), message },
      locale,
      variantContext,
      templateKey: "nudge.todo_creation_message",
    });
  }

  return renderNotificationTemplate(SOCIAL_COPY.REMIND_NUDGE_RECEIVED, {
    facts: { senderName: toNameFact(senderName, locale) },
    locale,
    variantContext,
    templateKey: "nudge.todo_creation",
  });
}

export function createCheerReceivedNotificationMessage({
  senderName,
  message,
  locale = DEFAULT_LOCALE,
  variantContext,
}: CheerReceivedNotificationInput): NotificationMessage {
  if (message) {
    return renderNotificationTemplate(SOCIAL_COPY.CHEER_RECEIVED, {
      facts: { senderName: toNameFact(senderName, locale), message },
      locale,
      variantContext,
      templateKey: "cheer.message",
    });
  }

  return renderNotificationTemplate(SOCIAL_COPY.CHEER_RECEIVED_NO_MESSAGE, {
    facts: { senderName: toNameFact(senderName, locale) },
    locale,
    variantContext,
    templateKey: "cheer.standard",
  });
}

export function createFriendCompletedNotificationMessage({
  friendName,
  locale = DEFAULT_LOCALE,
  variantContext,
}: FriendCompletedNotificationInput): NotificationMessage {
  return renderNotificationTemplate(SOCIAL_COPY.FRIEND_COMPLETED, {
    facts: { friendName: toNameFact(friendName, locale) },
    locale,
    variantContext,
    templateKey: "friend_completed",
  });
}

export function createTodoCommentNotificationMessage(
  input: TodoCommentNotificationCopyInput,
): NotificationMessage {
  const locale = input.locale ?? DEFAULT_LOCALE;
  const options = { locale, variantContext: input.variantContext };
  const senderName = toNameFact(input.senderName?.trim() || null, locale);

  if (input.activityKind === "LIKE") {
    return renderNotificationTemplate(SOCIAL_COPY.TODO_COMMENT_LIKE, {
      ...options,
      facts: { senderName },
      templateKey: "todo_comment.like",
    });
  }
  if (!Number.isSafeInteger(input.commentCount) || input.commentCount < 1) {
    throw new RangeError("commentCount must be a positive safe integer");
  }

  const isChain = input.commentCount > 1;
  if (input.activityKind === "COMMENT") {
    return isChain
      ? renderNotificationTemplate(SOCIAL_COPY.TODO_COMMENT_CHAIN, {
          ...options,
          facts: { senderName, count: input.commentCount },
          templateKey: "todo_comment.comment_chain",
        })
      : renderNotificationTemplate(SOCIAL_COPY.TODO_COMMENT, {
          ...options,
          facts: { senderName },
          templateKey: "todo_comment.comment",
        });
  }

  if (isChain) {
    return renderNotificationTemplate(SOCIAL_COPY.TODO_COMMENT_REPLY_CHAIN, {
      ...options,
      facts: { senderName, count: input.commentCount },
      templateKey: "todo_comment.reply_chain",
    });
  }

  return input.replyTarget === "REPLY"
    ? renderNotificationTemplate(SOCIAL_COPY.TODO_COMMENT_REPLY_TO_REPLY, {
        ...options,
        facts: { senderName },
        templateKey: "todo_comment.reply_to_reply",
      })
    : renderNotificationTemplate(SOCIAL_COPY.TODO_COMMENT_REPLY, {
        ...options,
        facts: { senderName },
        templateKey: "todo_comment.reply",
      });
}

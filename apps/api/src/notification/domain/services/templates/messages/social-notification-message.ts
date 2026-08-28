import { DEFAULT_LOCALE, type SupportedLocale } from "@/shared/domain/locale";

import * as en from "../locales/en";
import * as ko from "../locales/ko";
import {
	createNotificationLabelPreview,
	renderLocalizedNotification,
} from "../notification-copy.renderer";
import type { NotificationMessage, NotificationVariantContext } from "../notification-copy.types";

const LOCALE_TEMPLATES = { ko, en };

interface LocalizedVariantInput {
	readonly locale?: SupportedLocale;
	readonly variantContext?: NotificationVariantContext;
}

interface SenderNotificationInput extends LocalizedVariantInput {
	readonly senderName: string;
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
			readonly activityKind: "COMMENT" | "REPLY";
			readonly commentCount: number;
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
	return renderLocalizedNotification({
		template: LOCALE_TEMPLATES[locale].SOCIAL_TEMPLATES.FOLLOW_NEW,
		variables: { senderName },
		variantContext,
		templateKey: "follow.request",
	});
}

export function createFollowAcceptedNotificationMessage({
	senderName,
	locale = DEFAULT_LOCALE,
	variantContext,
}: FollowAcceptedNotificationInput): NotificationMessage {
	return renderLocalizedNotification({
		template: LOCALE_TEMPLATES[locale].SOCIAL_TEMPLATES.FOLLOW_ACCEPTED,
		variables: { senderName },
		variantContext,
		templateKey: "follow.accepted",
	});
}

export function createNudgeReceivedNotificationMessage({
	senderName,
	todoTitle,
	message,
	locale = DEFAULT_LOCALE,
	variantContext,
}: NudgeReceivedNotificationInput): NotificationMessage {
	const variables = {
		senderName,
		todoTitle: todoTitle ? createNotificationLabelPreview({ label: todoTitle, locale }) : null,
	};

	if (message) {
		return renderLocalizedNotification({
			template: LOCALE_TEMPLATES[locale].SOCIAL_TEMPLATES.NUDGE_RECEIVED_WITH_MESSAGE,
			variables: { ...variables, message },
			variantContext,
			templateKey: "nudge.message",
		});
	}

	return renderLocalizedNotification({
		template: LOCALE_TEMPLATES[locale].SOCIAL_TEMPLATES.NUDGE_RECEIVED,
		variables,
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
		return renderLocalizedNotification({
			template: LOCALE_TEMPLATES[locale].SOCIAL_TEMPLATES.REMIND_NUDGE_RECEIVED_WITH_MESSAGE,
			variables: { senderName, message },
			variantContext,
			templateKey: "nudge.todo_creation_message",
		});
	}

	return renderLocalizedNotification({
		template: LOCALE_TEMPLATES[locale].SOCIAL_TEMPLATES.REMIND_NUDGE_RECEIVED,
		variables: { senderName },
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
		return renderLocalizedNotification({
			template: LOCALE_TEMPLATES[locale].SOCIAL_TEMPLATES.CHEER_RECEIVED,
			variables: { senderName, message },
			variantContext,
			templateKey: "cheer.message",
		});
	}

	return renderLocalizedNotification({
		template: LOCALE_TEMPLATES[locale].SOCIAL_TEMPLATES.CHEER_RECEIVED_NO_MESSAGE,
		variables: { senderName },
		variantContext,
		templateKey: "cheer.standard",
	});
}

export function createFriendCompletedNotificationMessage({
	friendName,
	locale = DEFAULT_LOCALE,
	variantContext,
}: FriendCompletedNotificationInput): NotificationMessage {
	return renderLocalizedNotification({
		template: LOCALE_TEMPLATES[locale].SOCIAL_TEMPLATES.FRIEND_COMPLETED,
		variables: { friendName },
		variantContext,
		templateKey: "friend_completed",
	});
}

export function createTodoCommentNotificationMessage(
	input: TodoCommentNotificationCopyInput,
): NotificationMessage {
	const locale = input.locale ?? DEFAULT_LOCALE;
	const templates = LOCALE_TEMPLATES[locale];
	const senderName = input.senderName?.trim() || templates.SOCIAL_SENDER_FALLBACK;

	if (input.activityKind === "LIKE") {
		return renderLocalizedNotification({
			template: templates.SOCIAL_TEMPLATES.TODO_COMMENT_LIKE,
			variables: { senderName },
			variantContext: input.variantContext,
			templateKey: "todo_comment.like",
		});
	}
	if (!Number.isSafeInteger(input.commentCount) || input.commentCount < 1) {
		throw new RangeError("commentCount must be a positive safe integer");
	}

	const isChain = input.commentCount > 1;
	if (input.activityKind === "COMMENT") {
		return isChain
			? renderLocalizedNotification({
					template: templates.SOCIAL_TEMPLATES.TODO_COMMENT_CHAIN,
					variables: { senderName, count: input.commentCount },
					variantContext: input.variantContext,
					templateKey: "todo_comment.comment_chain",
				})
			: renderLocalizedNotification({
					template: templates.SOCIAL_TEMPLATES.TODO_COMMENT,
					variables: { senderName },
					variantContext: input.variantContext,
					templateKey: "todo_comment.comment",
				});
	}

	return isChain
		? renderLocalizedNotification({
				template: templates.SOCIAL_TEMPLATES.TODO_COMMENT_REPLY_CHAIN,
				variables: { senderName, count: input.commentCount },
				variantContext: input.variantContext,
				templateKey: "todo_comment.reply_chain",
			})
		: renderLocalizedNotification({
				template: templates.SOCIAL_TEMPLATES.TODO_COMMENT_REPLY,
				variables: { senderName },
				variantContext: input.variantContext,
				templateKey: "todo_comment.reply",
			});
}

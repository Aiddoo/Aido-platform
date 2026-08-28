import { type NotificationActivityKind, NOTIFICATION_ACTION_TYPE } from "@aido/validators";
import { Injectable } from "@nestjs/common";

import { NotificationMessageBuilder, NotificationSender } from "@/notification";

import type {
	TodoCommentNotificationPort,
	TodoCommentWrittenInput,
} from "../../application/ports/todo-comment-notification.port";

interface LikedInput {
	recipientId: string;
	senderId: string;
	senderName: string | null;
	todoId: number;
	commentId: string;
	threadRootId: string;
}

@Injectable()
export class TodoCommentNotificationAdapter implements TodoCommentNotificationPort {
	constructor(private readonly notificationSender: NotificationSender) {}

	notifyCommentsWritten(input: TodoCommentWrittenInput): Promise<void> {
		return this.#send(input, input.isReply ? "REPLY" : "COMMENT", input.count);
	}

	notifyCommentLiked(input: LikedInput): Promise<void> {
		return this.#send(input, "LIKE", 1);
	}

	/**
	 * 알림 타입은 TODO_SHARED 그대로 둔다 — 새 타입을 늘리면 구버전 앱의 목록 파싱이 통째로 깨진다.
	 * 무엇에 달렸는지는 문구와 activityKind가 말한다.
	 */
	async #send(input: LikedInput, kind: NotificationActivityKind, count: number): Promise<void> {
		if (input.recipientId === input.senderId) {
			return;
		}

		const locale = await this.notificationSender.getUserLocale(input.recipientId);
		const copy = NotificationMessageBuilder.todoCommentActivity(
			kind,
			input.senderName,
			locale,
			count,
		);
		await this.notificationSender.createAndSend({
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
				commentId: input.commentId,
				threadRootId: input.threadRootId,
				activityKind: kind,
			},
		});
	}
}

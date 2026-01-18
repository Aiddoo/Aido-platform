import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import {
	type FriendCompletedEventPayload,
	NotificationEvents,
	type TodoAllCompletedEventPayload,
	type TodoReminderEventPayload,
} from "../events/notification.events";
import { NotificationService } from "../notification.service";
import { NotificationMessageBuilder } from "../templates/notification-templates";

/**
 * Todo 이벤트 리스너
 *
 * TodoModule과 SchedulerModule에서 발행하는 이벤트를 수신하여 알림을 생성합니다.
 * - todo.all_completed: 오늘 할일 전체 완료
 * - todo.reminder: 할일 마감 리마인더
 * - friend.completed: 친구가 오늘 할일 전체 완료
 */
@Injectable()
export class TodoListener {
	private readonly logger = new Logger(TodoListener.name);

	constructor(private readonly notificationService: NotificationService) {}

	/**
	 * 오늘 할일 전체 완료 이벤트 처리
	 *
	 * 사용자에게 완료 축하 알림을 발송하고,
	 * 친구들에게도 알림을 발송하기 위해 friend.completed 이벤트를 발행합니다.
	 * (friend.completed 이벤트 발행은 TodoModule에서 담당)
	 */
	@OnEvent(NotificationEvents.TODO_ALL_COMPLETED)
	async handleTodoAllCompleted(
		payload: TodoAllCompletedEventPayload,
	): Promise<void> {
		this.logger.debug(
			`Handling todo.all_completed event: userId=${payload.userId}, count=${payload.completedCount}`,
		);

		try {
			await this.notificationService.createAndSend({
				userId: payload.userId,
				type: "DAILY_COMPLETE",
				title: "완벽한 하루였어요!",
				body: `오늘 ${payload.completedCount}개의 할일을 모두 완료했어요 🎉`,
				route: "/",
			});

			this.logger.log(
				`Daily completion notification sent to user: ${payload.userId}`,
			);
		} catch (error) {
			this.logger.error(
				`Failed to send daily completion notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	/**
	 * 할일 리마인더 이벤트 처리
	 *
	 * 마감이 임박한 할일에 대해 알림을 발송합니다.
	 * SchedulerModule의 크론 작업에서 발행합니다.
	 */
	@OnEvent(NotificationEvents.TODO_REMINDER)
	async handleTodoReminder(payload: TodoReminderEventPayload): Promise<void> {
		this.logger.debug(
			`Handling todo.reminder event: userId=${payload.userId}, todoId=${payload.todoId}`,
		);

		try {
			const message = NotificationMessageBuilder.todoReminder(
				payload.todoTitle,
			);

			await this.notificationService.createAndSend({
				userId: payload.userId,
				type: "TODO_REMINDER",
				title: message.title,
				body: message.body,
				route: `/todos/${payload.todoId}`,
				todoId: payload.todoId,
			});

			this.logger.log(
				`Todo reminder notification sent: userId=${payload.userId}, todoId=${payload.todoId}`,
			);
		} catch (error) {
			this.logger.error(
				`Failed to send todo reminder notification: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	/**
	 * 친구 할일 완료 이벤트 처리
	 *
	 * 친구가 오늘 할일을 모두 완료했을 때, 친구들에게 알림을 발송합니다.
	 */
	@OnEvent(NotificationEvents.FRIEND_COMPLETED)
	async handleFriendCompleted(
		payload: FriendCompletedEventPayload,
	): Promise<void> {
		this.logger.debug(
			`Handling friend.completed event: friendId=${payload.friendId}, notifyCount=${payload.notifyUserIds.length}`,
		);

		if (payload.notifyUserIds.length === 0) {
			this.logger.debug("No friends to notify for friend completion");
			return;
		}

		try {
			const message = NotificationMessageBuilder.friendCompleted(
				payload.friendName,
			);

			const notifications = payload.notifyUserIds.map((userId) => ({
				userId,
				type: "FRIEND_COMPLETED" as const,
				title: message.title,
				body: message.body,
				route: `/friends/${payload.friendId}`,
				friendId: payload.friendId,
			}));

			await this.notificationService.createAndSendBatch(notifications);

			this.logger.log(
				`Friend completion notifications sent: friendId=${payload.friendId}, count=${payload.notifyUserIds.length}`,
			);
		} catch (error) {
			this.logger.error(
				`Failed to send friend completion notifications: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}

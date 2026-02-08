import { Injectable, Logger } from "@nestjs/common";
import { OnEvent } from "@nestjs/event-emitter";

import { getUserToday } from "@/common/date/utils/date.util";
import { DatabaseService } from "@/database/database.service";
import { Prisma } from "@/generated/prisma/client";

import {
	type FriendCompletedEventPayload,
	NotificationEvents,
	type TodoAllCompletedEventPayload,
	type TodoReminderEventPayload,
} from "../events/notification.events";
import { NotificationRepository } from "../notification.repository";
import { NotificationService } from "../notification.service";
import { NotificationMessageBuilder } from "../templates/notification-templates";

/**
 * Todo 이벤트 리스너
 *
 * TodoModule과 SchedulerModule에서 발행하는 이벤트를 수신하여 알림을 생성합니다.
 * - todo.all_completed: 오늘 할일 전체 완료
 * - todo.reminder: 할일 마감 리마인더
 * - friend.completed: 친구가 오늘 할일 전체 완료
 *
 * 중복 방지:
 * - Transaction으로 check-and-create를 원자적으로 수행 (NudgeService 패턴)
 * - DB unique constraint (partial index)로 최종 방어 — P2002 graceful catch
 */
@Injectable()
export class TodoListener {
	private readonly logger = new Logger(TodoListener.name);

	constructor(
		private readonly notificationService: NotificationService,
		private readonly notificationRepository: NotificationRepository,
		private readonly database: DatabaseService,
	) {}

	/**
	 * 오늘 할일 전체 완료 이벤트 처리
	 *
	 * 사용자에게 완료 축하 알림을 발송합니다.
	 * 트랜잭션 내에서 중복 체크 → 생성을 원자적으로 수행합니다.
	 * 클라이언트가 type(DAILY_COMPLETE)으로 라우팅 결정 → 홈 화면
	 */
	@OnEvent(NotificationEvents.TODO_ALL_COMPLETED)
	async handleTodoAllCompleted(
		payload: TodoAllCompletedEventPayload,
	): Promise<void> {
		this.logger.debug(
			`Handling todo.all_completed event: userId=${payload.userId}, count=${payload.completedCount}`,
		);

		try {
			const today = getUserToday(payload.timezone);

			await this.database.$transaction(async (tx) => {
				const alreadySent =
					await this.notificationRepository.existsNotification(
						{
							userId: payload.userId,
							type: "DAILY_COMPLETE",
							since: today,
						},
						tx,
					);

				if (alreadySent) {
					this.logger.debug(
						`Daily completion already sent today: userId=${payload.userId}`,
					);
					return;
				}

				const message = NotificationMessageBuilder.dailyComplete(
					payload.completedCount,
				);

				await this.notificationService.createAndSend(
					{
						userId: payload.userId,
						type: "DAILY_COMPLETE",
						title: message.title,
						body: message.body,
						notificationDate: today,
					},
					tx,
				);

				this.logger.log(
					`Daily completion notification sent to user: ${payload.userId}`,
				);
			});
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				this.logger.debug(
					`Daily completion duplicate prevented by constraint: userId=${payload.userId}`,
				);
				return;
			}

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
	 * 클라이언트가 type(TODO_REMINDER) + context(todoId)로 라우팅 결정
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
	 * 트랜잭션 내에서 중복 체크 → 생성을 원자적으로 수행합니다.
	 * 클라이언트가 type(FRIEND_COMPLETED) + context(friendId)로 라우팅 결정
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
			const today = getUserToday(payload.timezone);

			await this.database.$transaction(async (tx) => {
				const alreadyNotified =
					await this.notificationRepository.findAlreadyNotifiedUserIds(
						{
							userIds: payload.notifyUserIds,
							type: "FRIEND_COMPLETED",
							since: today,
							friendId: payload.friendId,
						},
						tx,
					);

				const newUserIds = payload.notifyUserIds.filter(
					(id) => !alreadyNotified.has(id),
				);

				if (newUserIds.length === 0) {
					this.logger.debug(
						`Friend completion already sent today: friendId=${payload.friendId}`,
					);
					return;
				}

				const message = NotificationMessageBuilder.friendCompleted(
					payload.friendName,
				);

				const notifications = newUserIds.map((userId) => ({
					userId,
					type: "FRIEND_COMPLETED" as const,
					title: message.title,
					body: message.body,
					friendId: payload.friendId,
					notificationDate: today,
				}));

				await this.notificationService.createAndSendBatch(notifications, tx);

				this.logger.log(
					`Friend completion notifications sent: friendId=${payload.friendId}, count=${newUserIds.length}`,
				);
			});
		} catch (error) {
			if (
				error instanceof Prisma.PrismaClientKnownRequestError &&
				error.code === "P2002"
			) {
				this.logger.debug(
					`Friend completion duplicate prevented by constraint: friendId=${payload.friendId}`,
				);
				return;
			}

			this.logger.error(
				`Failed to send friend completion notifications: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}

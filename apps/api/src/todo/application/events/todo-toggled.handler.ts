import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { todayInTimezone } from "@/shared/domain/date/utils/timezone";
import { TodoToggledEvent } from "../../domain/events/todo-toggled.event";
import {
	isAllCompletedToday,
	milestoneForCount,
} from "../../domain/services/completion-policy";
import { FRIEND_PORT, type FriendPort } from "../ports/friend.port";
import { STREAK_PORT, type StreakPort } from "../ports/streak.port";
import {
	TODO_NOTIFICATION,
	type TodoNotificationPort,
} from "../ports/todo-notification.port";
import {
	TODO_READ_REPOSITORY,
	type TodoReadRepositoryPort,
} from "../ports/todo-read.repository.port";
import {
	TODO_REMINDER,
	type TodoReminderPort,
} from "../ports/todo-reminder.port";

/**
 * Todo 완료 토글 이벤트 핸들러
 *
 * - 스트릭 갱신은 양방향(완료/미완료)으로 수행합니다.
 * - 완료로 전환된 경우에만 리마인더 취소 + 친구 완료 알림 + 마일스톤 체크를 수행합니다.
 *
 * 모든 부수효과는 fire-and-forget이며 실패는 로깅만 합니다(기존 동작 보존).
 * 크로스모듈 의존은 포트를 통해서만, 판단 규칙은 도메인 정책(completion-policy)을 통해 접근합니다.
 */
@EventsHandler(TodoToggledEvent)
export class TodoToggledHandler implements IEventHandler<TodoToggledEvent> {
	readonly #logger = new Logger(TodoToggledHandler.name);

	constructor(
		@Inject(TODO_READ_REPOSITORY)
		private readonly todoReadRepository: TodoReadRepositoryPort,
		@Inject(FRIEND_PORT)
		private readonly friendPort: FriendPort,
		@Inject(TODO_NOTIFICATION)
		private readonly todoNotification: TodoNotificationPort,
		@Inject(STREAK_PORT)
		private readonly streakPort: StreakPort,
		@Inject(TODO_REMINDER)
		private readonly todoReminder: TodoReminderPort,
	) {}

	handle(event: TodoToggledEvent): void {
		const { todoId, userId, completed, timezone } = event;

		if (completed) {
			this.todoReminder.cancelReminder(todoId);
			void this.#checkAndEnqueueFriendCompleted(userId, timezone);
			void this.#checkAndEnqueueMilestone(userId);
		}

		// 스트릭은 양방향 갱신 (fire-and-forget)
		this.streakPort.recordTodoToggle(userId, completed, timezone);
	}

	/**
	 * 오늘 할일 전체 완료 시 친구들에게 알림 큐에 등록
	 */
	async #checkAndEnqueueFriendCompleted(
		userId: string,
		timezone: string,
	): Promise<void> {
		try {
			const today = todayInTimezone(timezone);
			const stats = await this.todoReadRepository.getTodayTodoStats(
				userId,
				today,
			);

			if (isAllCompletedToday(stats)) {
				const [friendIds, userName] = await Promise.all([
					this.friendPort.getMutualFriendIds(userId),
					this.friendPort.getUserDisplayName(userId),
				]);

				if (friendIds.length > 0) {
					this.todoNotification.enqueueFriendCompleted({
						friendId: userId,
						friendName: userName,
						notifyUserIds: friendIds,
						timezone,
					});

					this.#logger.log(
						`Friend completed event enqueued for ${friendIds.length} friends`,
					);
				}
			}
		} catch (error) {
			this.#logger.error(
				`Failed to check/enqueue friend completed event: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	/**
	 * 마일스톤 달성 여부 체크 및 알림 큐 등록
	 */
	async #checkAndEnqueueMilestone(userId: string): Promise<void> {
		try {
			const count = await this.todoReadRepository.countCompletedByUser(userId);
			const milestone = milestoneForCount(count);
			if (!milestone) {
				return;
			}
			this.todoNotification.enqueueMilestoneReached({
				userId,
				milestone,
			});
		} catch (error) {
			this.#logger.error(
				`Failed to check milestone event: userId=${userId}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}

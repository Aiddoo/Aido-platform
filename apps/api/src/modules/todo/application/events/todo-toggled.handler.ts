import { Inject, Logger } from "@nestjs/common";
import { EventsHandler, type IEventHandler } from "@nestjs/cqrs";
import { todayInTimezone } from "@/common/date/utils/timezone";
import { FollowService } from "../../../follow/follow.service";
import type { MilestoneReachedJobData } from "../../../notification/queue/notification-queue.constants";
import { NotificationQueueService } from "../../../notification/queue/notification-queue.service";
import {
	type IReminderScheduler,
	REMINDER_SCHEDULER,
} from "../../../scheduler/reminder";
import { StreakService } from "../../../user-settings/services/streak.service";
import { TodoToggledEvent } from "../../domain/events/todo-toggled.event";
import {
	TODO_REPOSITORY,
	type TodoRepositoryPort,
} from "../ports/todo.repository.port";

/** 누적 완료 카운트 → 마일스톤 매핑 */
const COMPLETION_MILESTONES: ReadonlyMap<
	number,
	MilestoneReachedJobData["milestone"]
> = new Map([
	[1, "FIRST_COMPLETE"],
	[10, "COUNT_10"],
	[50, "COUNT_50"],
	[100, "COUNT_100"],
]);

/**
 * Todo 완료 토글 이벤트 핸들러
 *
 * - 스트릭 갱신은 양방향(완료/미완료)으로 수행합니다.
 * - 완료로 전환된 경우에만 리마인더 취소 + 친구 완료 알림 + 마일스톤 체크를 수행합니다.
 *
 * 모든 부수효과는 fire-and-forget이며 실패는 로깅만 합니다(기존 동작 보존).
 */
@EventsHandler(TodoToggledEvent)
export class TodoToggledHandler implements IEventHandler<TodoToggledEvent> {
	readonly #logger = new Logger(TodoToggledHandler.name);

	constructor(
		@Inject(TODO_REPOSITORY)
		private readonly todoRepository: TodoRepositoryPort,
		private readonly followService: FollowService,
		private readonly notificationQueueService: NotificationQueueService,
		private readonly streakService: StreakService,
		@Inject(REMINDER_SCHEDULER)
		private readonly reminderScheduler: IReminderScheduler,
	) {}

	handle(event: TodoToggledEvent): void {
		const { todoId, userId, completed, timezone } = event;

		if (completed) {
			this.reminderScheduler.cancelReminder(todoId);
			void this.#checkAndEnqueueFriendCompleted(userId, timezone);
			void this.#checkAndEnqueueMilestone(userId);
		}

		// 스트릭은 양방향 갱신 (fire-and-forget)
		this.streakService.onTodoToggled(userId, completed, timezone);
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
			const stats = await this.todoRepository.getTodayTodoStats(userId, today);

			if (stats.total > 0 && stats.total === stats.completed) {
				const [friendIds, userName] = await Promise.all([
					this.followService.getMutualFriendIds(userId),
					this.followService.getUserDisplayName(userId),
				]);

				if (friendIds.length > 0) {
					this.notificationQueueService.enqueueFriendCompleted({
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
			const count = await this.todoRepository.countCompletedByUser(userId);
			const milestone = COMPLETION_MILESTONES.get(count);
			if (!milestone) {
				return;
			}
			this.notificationQueueService.enqueueMilestoneReached({
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

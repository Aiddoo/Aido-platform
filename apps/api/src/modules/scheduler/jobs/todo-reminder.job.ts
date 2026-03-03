import { Inject, Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";

import { addMilliseconds, subtractDays } from "@/common/date/utils/arithmetic";
import { now } from "@/common/date/utils/core";
import { type ILockProvider, LOCK_PROVIDER } from "@/common/lock";
import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../../notification/notification.service";
import { NotificationMessageBuilder } from "../../notification/templates/notification-templates";
import { REMINDER_STAGES } from "../constants/reminder.constants";

/**
 * 할일 마감 리마인더 크론 작업 (폴백)
 *
 * 10분마다 실행되어 각 리마인더 단계(60분 전, 10분 전)에 해당하는 할일을 찾아 알림을 발송합니다.
 * InMemoryReminderSchedulerAdapter의 이중 안전장치 역할을 합니다.
 * DB 기반으로 단계별 중복 알림을 방지합니다 (metadata.stage 매칭).
 *
 * 중복 발송 방지 전략:
 * 1. 전역 Lock (`todo-reminder`) — 크론 다중 실행 방지
 * 2. per-todo Lock (`reminder:${todoId}:${stageLabel}`) — InMemoryScheduler와 동일 키로 Race Condition 방지
 * 3. Lock 내부 DB 재확인 — 이미 발송된 알림 최종 체크
 */
@Injectable()
export class TodoReminderJob {
	readonly #logger = new Logger(TodoReminderJob.name);

	/** per-todo Lock TTL (InMemoryScheduler와 동일) */
	static readonly DEDUP_LOCK_TTL = 5_000;

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
		@Inject(LOCK_PROVIDER) private readonly lockProvider: ILockProvider,
	) {}

	/**
	 * 10분마다 실행
	 * 각 단계별로 해당 시간 범위의 할일을 찾아 알림을 발송합니다.
	 */
	@Cron("*/10 * * * *")
	async handleTodoReminder(): Promise<void> {
		this.#logger.log("Starting todo reminder job...");

		const release = await this.lockProvider.acquire(
			"todo-reminder",
			9 * 60 * 1000,
		);

		if (!release) {
			this.#logger.warn(
				"Skipping todo reminder — another instance holds the lock",
			);
			return;
		}

		try {
			await this.#execute();
		} catch (error) {
			this.#logger.error(
				`Todo reminder job failed: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		} finally {
			await release();
		}
	}

	async #execute(): Promise<void> {
		const currentTime = now();
		const twentyFourHoursAgo = subtractDays(1, currentTime);
		const cronIntervalMs = 10 * 60 * 1000;

		for (const stage of REMINDER_STAGES) {
			try {
				// 이 단계의 스캔 윈도우: [now + leadTime - 10분, now + leadTime)
				const reminderStart = addMilliseconds(
					stage.leadTimeMs - cronIntervalMs,
					currentTime,
				);
				const reminderEnd = addMilliseconds(stage.leadTimeMs, currentTime);

				const todosToNotify = await this.database.todo.findMany({
					where: {
						scheduledTime: {
							gte: reminderStart,
							lt: reminderEnd,
						},
						completed: false,
						user: {
							pushTokens: {
								some: {},
							},
						},
					},
					select: {
						id: true,
						title: true,
						userId: true,
					},
				});

				if (todosToNotify.length === 0) {
					continue;
				}

				// 1차 필터: 이미 알림을 보낸 할일 제외 (배치 DB 조회)
				const todoIds = todosToNotify.map((todo) => todo.id);
				const existingNotifications = await this.database.notification.findMany(
					{
						where: {
							todoId: { in: todoIds },
							type: "TODO_REMINDER",
							createdAt: { gte: twentyFourHoursAgo },
							metadata: {
								path: ["stage"],
								equals: stage.label,
							},
						},
						select: { todoId: true },
					},
				);

				const alreadyNotifiedIds = new Set(
					existingNotifications.map((n) => n.todoId),
				);
				const newTodosToNotify = todosToNotify.filter(
					(todo) => !alreadyNotifiedIds.has(todo.id),
				);

				if (newTodosToNotify.length === 0) {
					continue;
				}

				// 2차: per-todo Lock 획득 → DB 재확인 → 개별 발송
				let sentCount = 0;
				for (const todo of newTodosToNotify) {
					const sent = await this.#sendWithLock(
						todo,
						stage.label,
						twentyFourHoursAgo,
					);
					if (sent) sentCount++;
				}

				if (sentCount > 0) {
					this.#logger.log(
						`Todo reminder (${stage.label}) sent for ${sentCount} todos`,
					);
				}
			} catch (error) {
				this.#logger.error(
					`Todo reminder stage "${stage.label}" failed: ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			}
		}
	}

	/**
	 * per-todo Lock 획득 후 DB 재확인 및 개별 발송
	 *
	 * InMemoryScheduler와 동일한 Lock 키(`reminder:${todoId}:${stageLabel}`)를 사용하여
	 * 두 시스템 간 Race Condition을 방지합니다.
	 */
	async #sendWithLock(
		todo: { id: number; title: string; userId: string },
		stageLabel: string,
		twentyFourHoursAgo: Date,
	): Promise<boolean> {
		const lockKey = `reminder:${todo.id}:${stageLabel}`;
		const release = await this.lockProvider.acquire(
			lockKey,
			TodoReminderJob.DEDUP_LOCK_TTL,
		);

		if (!release) {
			this.#logger.debug(
				`Reminder dedup: lock busy for todoId=${todo.id}, stage=${stageLabel}`,
			);
			return false;
		}

		try {
			// DB 재확인 (Lock 내부에서 최종 체크)
			const exists = await this.database.notification.findFirst({
				where: {
					todoId: todo.id,
					type: "TODO_REMINDER",
					createdAt: { gte: twentyFourHoursAgo },
					metadata: {
						path: ["stage"],
						equals: stageLabel,
					},
				},
				select: { id: true },
			});

			if (exists) {
				this.#logger.debug(
					`Reminder dedup: skipped todoId=${todo.id}, stage=${stageLabel} (already notified)`,
				);
				return false;
			}

			const message = NotificationMessageBuilder.todoReminder(
				todo.title,
				stageLabel,
			);

			await this.notificationService.createAndSend({
				userId: todo.userId,
				type: "TODO_REMINDER",
				title: message.title,
				body: message.body,
				todoId: todo.id,
				metadata: { stage: stageLabel },
			});

			return true;
		} catch (error) {
			this.#logger.error(
				`Failed to send reminder: todoId=${todo.id}, stage=${stageLabel}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
			return false;
		} finally {
			await release();
		}
	}
}

import {
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";

import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../../../notification/notification.service";
import { NotificationMessageBuilder } from "../../../notification/templates/notification-templates";
import {
	REMINDER_IMMEDIATE_LABEL,
	REMINDER_STAGES,
} from "../../constants/reminder.constants";

import type { IReminderScheduler } from "../interfaces/reminder-scheduler.interface";

/**
 * 인메모리 리마인더 스케줄러 어댑터
 *
 * setTimeout + nested Map 기반 다단계 인메모리 스케줄링으로
 * 각 단계(60분 전, 10분 전)에 리마인더 알림을 발송합니다.
 * 모든 단계가 이미 지났지만 scheduledTime이 미래인 경우 즉시 발송합니다.
 *
 * - 서버 재시작 시 DB에서 미래 리마인더 복구 (onModuleInit)
 * - 기존 TodoReminderJob 크론은 폴백으로 유지 (이중 안전장치)
 * - 24시간 내 동일 todoId + stage 조합 DB 중복 방지
 * - 단일 프로세스 환경에서만 유효 (수평 확장 시 BullMQ 등 필요)
 */
@Injectable()
export class InMemoryReminderSchedulerAdapter
	implements IReminderScheduler, OnModuleInit, OnModuleDestroy
{
	readonly #logger = new Logger(InMemoryReminderSchedulerAdapter.name);
	/** todoId → (stageLabel → timer) */
	readonly #timers = new Map<number, Map<string, NodeJS.Timeout>>();

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
	) {}

	async onModuleInit(): Promise<void> {
		await this.#recoverPendingReminders();
	}

	onModuleDestroy(): void {
		for (const [todoId, stageTimers] of this.#timers.entries()) {
			for (const [label, timer] of stageTimers.entries()) {
				clearTimeout(timer);
				this.#logger.debug(
					`Timer cleared on destroy: todoId=${todoId}, stage=${label}`,
				);
			}
		}
		this.#timers.clear();
		this.#logger.log("All reminder timers cleared");
	}

	/**
	 * 다단계 리마인더 타이머 등록
	 *
	 * REMINDER_STAGES를 순회하며 각 단계별 타이머를 등록합니다.
	 * 모든 단계가 이미 지났지만 scheduledTime이 미래인 경우 즉시 발송합니다.
	 * 같은 todoId로 재호출하면 기존 모든 단계를 취소하고 새로 등록합니다.
	 */
	scheduleReminder(
		todoId: number,
		scheduledTime: Date,
		userId: string,
		todoTitle: string,
	): void {
		this.cancelReminder(todoId);

		const now = Date.now();
		const scheduledMs = scheduledTime.getTime();

		// scheduledTime이 이미 과거면 아무것도 안 함
		if (scheduledMs <= now) {
			this.#logger.debug(
				`Scheduled time already passed: todoId=${todoId}, skipping`,
			);
			return;
		}

		let hasScheduledTimer = false;

		for (const stage of REMINDER_STAGES) {
			const reminderTime = scheduledMs - stage.leadTimeMs;
			const delay = reminderTime - now;

			if (delay > 0) {
				hasScheduledTimer = true;
				this.#registerTimer(todoId, stage.label, delay, () =>
					this.#sendReminder(todoId, userId, todoTitle, stage.label),
				);
			}
		}

		// 모든 단계가 이미 지났지만 scheduledTime은 아직 미래 → 즉시 발송
		if (!hasScheduledTimer) {
			this.#sendReminder(
				todoId,
				userId,
				todoTitle,
				REMINDER_IMMEDIATE_LABEL,
			).catch((error) => {
				this.#logger.error(
					`Failed to send immediate reminder: todoId=${todoId}, ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			});
		}
	}

	/**
	 * 리마인더 타이머 취소 (모든 단계)
	 */
	cancelReminder(todoId: number): void {
		const stageTimers = this.#timers.get(todoId);
		if (stageTimers) {
			for (const [label, timer] of stageTimers.entries()) {
				clearTimeout(timer);
				this.#logger.debug(
					`Reminder cancelled: todoId=${todoId}, stage=${label}`,
				);
			}
			this.#timers.delete(todoId);
		}
	}

	/**
	 * 개별 단계 타이머 등록
	 */
	#registerTimer(
		todoId: number,
		label: string,
		delay: number,
		callback: () => Promise<void>,
	): void {
		const timer = setTimeout(() => {
			const stageTimers = this.#timers.get(todoId);
			if (stageTimers) {
				stageTimers.delete(label);
				if (stageTimers.size === 0) {
					this.#timers.delete(todoId);
				}
			}
			callback().catch((error) => {
				this.#logger.error(
					`Failed to send reminder: todoId=${todoId}, stage=${label}, ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			});
		}, delay);

		let stageTimers = this.#timers.get(todoId);
		if (!stageTimers) {
			stageTimers = new Map();
			this.#timers.set(todoId, stageTimers);
		}
		stageTimers.set(label, timer);

		this.#logger.debug(
			`Reminder scheduled: todoId=${todoId}, stage=${label}, delay=${Math.round(delay / 1000)}s`,
		);
	}

	/**
	 * 리마인더 알림 발송 (단계별 24시간 DB 중복 방지)
	 */
	async #sendReminder(
		todoId: number,
		userId: string,
		todoTitle: string,
		stageLabel: string,
	): Promise<void> {
		try {
			const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

			const exists = await this.database.notification.findFirst({
				where: {
					todoId,
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
					`Reminder dedup: skipped todoId=${todoId}, stage=${stageLabel} (already notified)`,
				);
				return;
			}

			const message = NotificationMessageBuilder.todoReminder(
				todoTitle,
				stageLabel,
			);

			await this.notificationService.createAndSend({
				userId,
				type: "TODO_REMINDER",
				title: message.title,
				body: message.body,
				todoId,
				metadata: { stage: stageLabel },
			});

			this.#logger.log(
				`Reminder sent: todoId=${todoId}, stage=${stageLabel}, userId=${userId}`,
			);
		} catch (error) {
			this.#logger.error(
				`Failed to send reminder: todoId=${todoId}, stage=${stageLabel}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}

	/**
	 * 서버 재시작 시 미래 리마인더 복구
	 *
	 * scheduledTime이 미래인 미완료 투두를 조회하고,
	 * scheduleReminder를 호출하여 다단계 타이머를 재등록합니다.
	 * 이미 발송된 단계는 sendReminder 내부의 DB 중복 체크가 필터링합니다.
	 */
	async #recoverPendingReminders(): Promise<void> {
		try {
			const now = new Date();

			const todosToRecover = await this.database.todo.findMany({
				where: {
					scheduledTime: { gt: now },
					completed: false,
					user: {
						pushTokens: { some: {} },
					},
				},
				select: {
					id: true,
					title: true,
					userId: true,
					scheduledTime: true,
				},
			});

			if (todosToRecover.length === 0) {
				this.#logger.log("No pending reminders to recover");
				return;
			}

			let recovered = 0;
			for (const todo of todosToRecover) {
				if (todo.scheduledTime) {
					this.scheduleReminder(
						todo.id,
						todo.scheduledTime,
						todo.userId,
						todo.title,
					);
					recovered++;
				}
			}

			this.#logger.log(`Recovered ${recovered} pending reminders`);
		} catch (error) {
			this.#logger.error(
				`Failed to recover pending reminders: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}

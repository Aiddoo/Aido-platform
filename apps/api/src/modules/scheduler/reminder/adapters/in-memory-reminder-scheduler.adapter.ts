import {
	Injectable,
	Logger,
	type OnModuleDestroy,
	type OnModuleInit,
} from "@nestjs/common";

import { DatabaseService } from "@/database/database.service";

import { NotificationService } from "../../../notification/notification.service";
import { NotificationMessageBuilder } from "../../../notification/templates/notification-templates";
import { REMINDER_LEAD_TIME_MS } from "../../constants/reminder.constants";

import type { IReminderScheduler } from "../interfaces/reminder-scheduler.interface";

/**
 * 인메모리 리마인더 스케줄러 어댑터
 *
 * setTimeout + Map 기반 인메모리 스케줄링으로
 * 정확한 시점에 리마인더 알림을 발송합니다.
 *
 * - 서버 재시작 시 DB에서 미래 리마인더 복구 (onModuleInit)
 * - 기존 TodoReminderJob 크론은 폴백으로 유지 (이중 안전장치)
 * - 24시간 내 동일 todoId TODO_REMINDER DB 중복 방지
 * - 단일 프로세스 환경에서만 유효 (수평 확장 시 BullMQ 등 필요)
 */
@Injectable()
export class InMemoryReminderSchedulerAdapter
	implements IReminderScheduler, OnModuleInit, OnModuleDestroy
{
	private readonly logger = new Logger(InMemoryReminderSchedulerAdapter.name);
	private readonly timers = new Map<number, NodeJS.Timeout>();

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
	) {}

	async onModuleInit(): Promise<void> {
		await this.recoverPendingReminders();
	}

	onModuleDestroy(): void {
		for (const [todoId, timer] of this.timers.entries()) {
			clearTimeout(timer);
			this.logger.debug(`Timer cleared on destroy: todoId=${todoId}`);
		}
		this.timers.clear();
		this.logger.log(`All reminder timers cleared (count=${this.timers.size})`);
	}

	/**
	 * 리마인더 타이머 등록
	 *
	 * scheduledTime - REMINDER_LEAD_TIME_MS 시점에 알림을 발송하도록 예약합니다.
	 * 같은 todoId로 재호출하면 기존 타이머를 취소하고 새로 등록합니다.
	 */
	scheduleReminder(
		todoId: number,
		scheduledTime: Date,
		userId: string,
		todoTitle: string,
	): void {
		// 기존 타이머 취소
		this.cancelReminder(todoId);

		const reminderTime = scheduledTime.getTime() - REMINDER_LEAD_TIME_MS;
		const delay = reminderTime - Date.now();

		if (delay <= 0) {
			this.logger.debug(
				`Reminder time already passed: todoId=${todoId}, skipping`,
			);
			return;
		}

		const timer = setTimeout(() => {
			this.timers.delete(todoId);
			this.sendReminder(todoId, userId, todoTitle).catch((error) => {
				this.logger.error(
					`Failed to send reminder: todoId=${todoId}, ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			});
		}, delay);

		this.timers.set(todoId, timer);
		this.logger.debug(
			`Reminder scheduled: todoId=${todoId}, delay=${Math.round(delay / 1000)}s`,
		);
	}

	/**
	 * 리마인더 타이머 취소
	 */
	cancelReminder(todoId: number): void {
		const timer = this.timers.get(todoId);
		if (timer) {
			clearTimeout(timer);
			this.timers.delete(todoId);
			this.logger.debug(`Reminder cancelled: todoId=${todoId}`);
		}
	}

	/**
	 * 리마인더 알림 발송 (24시간 DB 중복 방지)
	 */
	private async sendReminder(
		todoId: number,
		userId: string,
		todoTitle: string,
	): Promise<void> {
		const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

		const exists = await this.database.notification.findFirst({
			where: {
				todoId,
				type: "TODO_REMINDER",
				createdAt: { gte: twentyFourHoursAgo },
			},
			select: { id: true },
		});

		if (exists) {
			this.logger.debug(
				`Reminder dedup: skipped todoId=${todoId} (already notified)`,
			);
			return;
		}

		const message = NotificationMessageBuilder.todoReminder(todoTitle);

		await this.notificationService.createAndSend({
			userId,
			type: "TODO_REMINDER",
			title: message.title,
			body: message.body,
			todoId,
		});

		this.logger.log(`Reminder sent: todoId=${todoId}, userId=${userId}`);
	}

	/**
	 * 서버 재시작 시 미래 리마인더 복구
	 *
	 * scheduledTime이 현재 이후인 미완료 투두 중
	 * 24시간 내 TODO_REMINDER가 없는 건을 복구합니다.
	 * LEAD_TIME 이내의 할일도 포함하여 복구하며,
	 * 이미 리마인더 시각이 지난 건은 scheduleReminder 내부에서 자동 스킵됩니다.
	 */
	private async recoverPendingReminders(): Promise<void> {
		try {
			const now = new Date();
			const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

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
				this.logger.log("No pending reminders to recover");
				return;
			}

			// 이미 알림된 todoId 조회
			const todoIds = todosToRecover.map((t) => t.id);
			const existingNotifications = await this.database.notification.findMany({
				where: {
					todoId: { in: todoIds },
					type: "TODO_REMINDER",
					createdAt: { gte: twentyFourHoursAgo },
				},
				select: { todoId: true },
			});

			const alreadyNotifiedIds = new Set(
				existingNotifications.map((n) => n.todoId),
			);

			let recovered = 0;
			for (const todo of todosToRecover) {
				if (alreadyNotifiedIds.has(todo.id) || !todo.scheduledTime) {
					continue;
				}

				this.scheduleReminder(
					todo.id,
					todo.scheduledTime,
					todo.userId,
					todo.title,
				);
				recovered++;
			}

			this.logger.log(`Recovered ${recovered} pending reminders`);
		} catch (error) {
			this.logger.error(
				`Failed to recover pending reminders: ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		}
	}
}

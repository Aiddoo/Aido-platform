import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";

import {
	REMINDER_IMMEDIATE_LABEL,
	REMINDER_STAGES,
} from "../../constants/reminder.constants";
import type { IReminderScheduler } from "../interfaces/reminder-scheduler.interface";

// =============================================================================
// Constants
// =============================================================================

export const TODO_REMINDER_QUEUE = "todo-reminder";

export interface ReminderJobData {
	todoId: number;
	userId: string;
	todoTitle: string;
	stageLabel: string;
}

// =============================================================================
// Adapter
// =============================================================================

/**
 * BullMQ 리마인더 스케줄러 어댑터
 *
 * - Redis 기반 지연 잡으로 정확한 시점에 리마인더 발송
 * - jobId 기반 중복 방지 (동일 todoId + stage = 덮어쓰기)
 * - 서버 재시작 후에도 잡 유지 (Redis 영속성)
 * - InMemoryReminderSchedulerAdapter 완전 대체
 */
@Injectable()
export class BullMQReminderSchedulerAdapter implements IReminderScheduler {
	readonly #logger = new Logger(BullMQReminderSchedulerAdapter.name);

	constructor(
		@InjectQueue(TODO_REMINDER_QUEUE)
		private readonly queue: Queue<ReminderJobData>,
	) {}

	/**
	 * 다단계 리마인더 잡 등록
	 *
	 * REMINDER_STAGES를 순회하며 각 단계별 지연 잡을 등록합니다.
	 * 모든 단계가 이미 지났지만 scheduledTime이 미래인 경우 즉시 발송 잡을 등록합니다.
	 * 같은 todoId로 재호출 시 기존 잡을 제거하고 새로 등록합니다.
	 */
	scheduleReminder(
		todoId: number,
		scheduledTime: Date,
		userId: string,
		todoTitle: string,
	): void {
		// 비동기 작업을 fire-and-forget으로 실행
		this.#scheduleAsync(todoId, scheduledTime, userId, todoTitle).catch(
			(error) => {
				this.#logger.error(
					`Failed to schedule reminder: todoId=${todoId}, ${error}`,
					error instanceof Error ? error.stack : undefined,
				);
			},
		);
	}

	/**
	 * 리마인더 잡 취소 (모든 단계)
	 */
	cancelReminder(todoId: number): void {
		this.#cancelAsync(todoId).catch((error) => {
			this.#logger.error(
				`Failed to cancel reminder: todoId=${todoId}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}

	async #scheduleAsync(
		todoId: number,
		scheduledTime: Date,
		userId: string,
		todoTitle: string,
	): Promise<void> {
		// 기존 잡 제거 (재스케줄링 지원)
		await this.#cancelAsync(todoId);

		const now = Date.now();
		const scheduledMs = scheduledTime.getTime();

		// scheduledTime이 이미 과거면 아무것도 안 함
		if (scheduledMs <= now) {
			this.#logger.debug(
				`Scheduled time already passed: todoId=${todoId}, skipping`,
			);
			return;
		}

		let hasScheduledJob = false;

		for (const stage of REMINDER_STAGES) {
			const reminderTime = scheduledMs - stage.leadTimeMs;
			const delay = reminderTime - now;

			if (delay > 0) {
				hasScheduledJob = true;
				await this.queue.add(
					"send-reminder",
					{ todoId, userId, todoTitle, stageLabel: stage.label },
					{
						jobId: `reminder_${todoId}_${stage.label}`,
						delay,
						removeOnComplete: true,
						removeOnFail: { count: 100, age: 86_400 },
					},
				);

				this.#logger.debug(
					`Reminder scheduled: todoId=${todoId}, stage=${stage.label}, delay=${Math.round(delay / 1000)}s`,
				);
			}
		}

		// 모든 단계가 이미 지났지만 scheduledTime은 아직 미래 → 즉시 발송
		if (!hasScheduledJob) {
			await this.queue.add(
				"send-reminder",
				{
					todoId,
					userId,
					todoTitle,
					stageLabel: REMINDER_IMMEDIATE_LABEL,
				},
				{
					jobId: `reminder_${todoId}_${REMINDER_IMMEDIATE_LABEL}`,
					delay: 0,
					removeOnComplete: true,
					removeOnFail: { count: 100, age: 86_400 },
				},
			);

			this.#logger.debug(`Immediate reminder scheduled: todoId=${todoId}`);
		}
	}

	async #cancelAsync(todoId: number): Promise<void> {
		const stages = [
			...REMINDER_STAGES.map((s) => s.label),
			REMINDER_IMMEDIATE_LABEL,
		];

		for (const label of stages) {
			const jobId = `reminder_${todoId}_${label}`;
			try {
				const job = await this.queue.getJob(jobId);
				if (job) {
					await job.remove();
					this.#logger.debug(
						`Reminder cancelled: todoId=${todoId}, stage=${label}`,
					);
				}
			} catch {
				// 잡이 이미 처리되었거나 없는 경우 무시
			}
		}
	}
}

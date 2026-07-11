import { InjectQueue } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import type { Queue } from "bullmq";

import type { IReminderScheduler } from "../../application/ports/reminder-scheduler.port";
import {
	allReminderLabels,
	planReminderJobs,
	REMINDER_IMMEDIATE_LABEL,
} from "../../domain/services/reminder-plan";

export const TODO_REMINDER_QUEUE = "todo-reminder";

export interface ReminderJobData {
	todoId: number;
	userId: string;
	stageLabel: string;
}

/**
 * BullMQ 리마인더 스케줄러 어댑터.
 *
 * - Redis 기반 지연 잡으로 정확한 시점에 리마인더 발송
 * - jobId 기반 중복 방지 (동일 todoId + stage = 덮어쓰기)
 * - 서버 재시작 후에도 잡 유지 (Redis 영속성)
 *
 * 예약 계획(어떤 단계를 언제)은 도메인 정책(planReminderJobs)이 결정하고,
 * 어댑터는 계획을 BullMQ 큐에 등록만 한다.
 */
@Injectable()
export class BullMQReminderSchedulerAdapter implements IReminderScheduler {
	readonly #logger = new Logger(BullMQReminderSchedulerAdapter.name);

	constructor(
		@InjectQueue(TODO_REMINDER_QUEUE)
		private readonly queue: Queue<ReminderJobData>,
	) {}

	scheduleReminder(todoId: number, scheduledTime: Date, userId: string): void {
		this.#scheduleAsync(todoId, scheduledTime, userId).catch((error) => {
			this.#logger.error(
				`Failed to schedule reminder: todoId=${todoId}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}

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
	): Promise<void> {
		// 기존 잡 제거 (재스케줄링 지원)
		await this.#cancelAsync(todoId);

		const jobs = planReminderJobs(scheduledTime.getTime(), Date.now());

		// scheduledTime이 이미 과거면 아무것도 안 함
		if (jobs.length === 0) {
			this.#logger.debug(
				`Scheduled time already passed: todoId=${todoId}, skipping`,
			);
			return;
		}

		for (const job of jobs) {
			await this.queue.add(
				"send-reminder",
				{ todoId, userId, stageLabel: job.label },
				{
					jobId: `reminder_${todoId}_${job.label}`,
					delay: job.delay,
					removeOnComplete: true,
					removeOnFail: { count: 100, age: 86_400 },
				},
			);

			if (job.label === REMINDER_IMMEDIATE_LABEL) {
				this.#logger.debug(`Immediate reminder scheduled: todoId=${todoId}`);
			} else {
				this.#logger.debug(
					`Reminder scheduled: todoId=${todoId}, stage=${job.label}, delay=${Math.round(job.delay / 1000)}s`,
				);
			}
		}
	}

	async #cancelAsync(todoId: number): Promise<void> {
		for (const label of allReminderLabels()) {
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

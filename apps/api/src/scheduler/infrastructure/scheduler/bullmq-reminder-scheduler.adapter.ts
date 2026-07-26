import { Inject, Injectable, Logger } from "@nestjs/common";
import {
	JOB_RUNTIME,
	type JobRuntimePort,
} from "@/shared/application/ports/job-runtime.port";

import type {
	IReminderScheduler,
	ReminderCancellationResult,
} from "../../application/ports/reminder-scheduler.port";
import {
	allReminderLabels,
	planReminderJobs,
	REMINDER_IMMEDIATE_LABEL,
} from "../../domain/services/reminder-plan";

export const TODO_REMINDER_QUEUE = "todo-reminder.v1";
export const TODO_REMINDER_LEGACY_QUEUE = "todo-reminder";
export const TODO_REMINDER_JOB_NAME = "send-reminder";

export interface ReminderJobData {
	todoId: number;
	userId: string;
	stageLabel: string;
}

export interface TodoReminderJobMap {
	[TODO_REMINDER_JOB_NAME]: ReminderJobData;
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

	constructor(@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort) {}

	scheduleReminder(todoId: number, scheduledTime: Date, userId: string): void {
		this.#scheduleAsync(todoId, scheduledTime, userId).catch((error) => {
			this.#logger.error(
				`Failed to schedule reminder: todoId=${todoId}, ${error}`,
				error instanceof Error ? error.stack : undefined,
			);
		});
	}

	cancelReminder(todoId: number): Promise<ReminderCancellationResult> {
		return this.#cancelAsync(todoId);
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
			await this.runtime.enqueue(
				TODO_REMINDER_QUEUE,
				{
					name: TODO_REMINDER_JOB_NAME,
					data: { todoId, userId, stageLabel: job.label },
				},
				{
					jobKey: `reminder_${todoId}_${job.label}`,
					startAfter: new Date(Date.now() + job.delay),
					retryLimit: 2,
					retryDelaySeconds: 5,
					retryBackoff: true,
					expireInSeconds: 10 * 60,
					retentionSeconds: 24 * 60 * 60,
					deleteAfterSeconds: 24 * 60 * 60,
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

	async #cancelAsync(todoId: number): Promise<ReminderCancellationResult> {
		let cancellationStatus: ReminderCancellationResult["status"] = "missing";

		for (const label of allReminderLabels()) {
			const jobId = `reminder_${todoId}_${label}`;
			try {
				const result = await this.runtime.cancel(TODO_REMINDER_QUEUE, jobId);
				if (result.status === "cancelled") {
					cancellationStatus = "cancelled";
					this.#logger.debug(
						`Reminder cancelled: todoId=${todoId}, stage=${label}`,
					);
				}
			} catch (error) {
				throw new Error(
					`Reminder cancellation failed: todoId=${todoId}, stage=${label}, runtime=job-runtime`,
					{ cause: error },
				);
			}
		}

		return { status: cancellationStatus };
	}
}

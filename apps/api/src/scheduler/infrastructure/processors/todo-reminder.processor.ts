import { Inject, Injectable, Logger, type OnModuleInit, Optional } from "@nestjs/common";

import { NotificationMessageBuilder, NotificationSender } from "@/notification";
import { JOB_POLLING_SECONDS } from "@/shared/application/ports";
import {
	JOB_RUNTIME,
	type JobData,
	type JobRuntimePort,
} from "@/shared/application/ports/job-runtime.port";
import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { fromLegacyJob, type NamedJob } from "@/shared/infrastructure/jobs/named-job";

import {
	TODO_REMINDER_READER,
	type TodoReminderReaderPort,
} from "../../application/ports/todo-reminder-reader.port";
import { SCHEDULER_CAMPAIGN_KEY } from "../../domain/services/notification-campaign";
import {
	type ReminderJobData,
	TODO_REMINDER_LEGACY_QUEUE,
	TODO_REMINDER_QUEUE,
	type TodoReminderJobMap,
} from "../scheduler/bullmq-reminder-scheduler.adapter";

/**
 * BullMQ 리마인더 잡 프로세서 (진입 어댑터).
 *
 * - 잡 실행 시 투두 유효성 확인 (완료/삭제 여부)
 * - 24시간 내 동일 알림 dedup
 * - 알림 발송 (NotificationSender)
 */
type TodoReminderJob = NamedJob<TodoReminderJobMap>;

@Injectable()
export class TodoReminderProcessor implements OnModuleInit {
	readonly #logger = new Logger(TodoReminderProcessor.name);

	constructor(
		@Inject(TODO_REMINDER_READER)
		private readonly reader: TodoReminderReaderPort,
		private readonly notification: NotificationSender,
		@Optional() @Inject(JOB_RUNTIME) private readonly runtime?: JobRuntimePort,
	) {}

	async onModuleInit(): Promise<void> {
		if (!this.runtime) return;
		await this.runtime.work<TodoReminderJob>(
			TODO_REMINDER_QUEUE,
			async (jobs) => {
				for (const job of jobs) await this.process(job.data.data);
			},
			{ teamSize: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED },
		);
		await this.runtime.work<JobData>(
			TODO_REMINDER_LEGACY_QUEUE,
			async (jobs) => {
				for (const job of jobs) await this.process(fromLegacyJob<TodoReminderJobMap>(job).data);
			},
			{ teamSize: 1, pollingIntervalSeconds: JOB_POLLING_SECONDS.SCHEDULED },
		);
	}

	onStalled(jobId: string): void {
		this.#logger.warn(`Job stalled: jobId=${jobId}`);
	}

	onError(error: Error): void {
		this.#logger.error(`Worker error: ${error.message}`, error.stack);
	}

	onFailed(job: { readonly id?: string; readonly name?: string } | undefined, error: Error) {
		this.#logger.error(
			`Job failed: jobId=${job?.id}, name=${job?.name}, error=${error.message}`,
			error.stack,
		);
	}

	async process(job: ReminderJobData | { readonly data: ReminderJobData }): Promise<void> {
		const data = "data" in job ? job.data : job;
		const { todoId, userId, stageLabel } = data;

		this.#logger.debug(`Processing reminder: todoId=${todoId}, stage=${stageLabel}`);

		// 1. 투두가 아직 유효한지 확인 (완료/삭제 여부)
		const todo = await this.reader.findActiveTodo(todoId);

		if (!todo) {
			this.#logger.debug(`Reminder skipped (todo completed/deleted): todoId=${todoId}`);
			return;
		}

		// 2. 24시간 내 동일 알림 DB dedup
		const twentyFourHoursAgo = subtractDays(1);
		const exists = await this.reader.existsRecentReminderNotification({
			todoId,
			since: twentyFourHoursAgo,
			stage: stageLabel,
		});

		if (exists) {
			this.#logger.debug(
				`Reminder dedup: skipped todoId=${todoId}, stage=${stageLabel} (already notified)`,
			);
			return;
		}

		// 3. 알림 발송 (DB에서 최신 제목 사용 — 스케줄링 이후 제목 변경 반영)
		// 언어는 UserPreference 캐시 경유 (발송 여부 판정과 같은 캐시 엔트리 공유)
		const locale = await this.notification.getUserLocale(userId);
		const message = NotificationMessageBuilder.todoReminder(todo.title, stageLabel, locale, {
			campaignKey: `${SCHEDULER_CAMPAIGN_KEY.TODO_REMINDER}.${stageLabel}`,
			recipientId: userId,
			occurrenceKey: `${todoId}:${stageLabel}`,
		});

		await this.notification.createAndSend({
			userId,
			type: "TODO_REMINDER",
			purpose: "SCHEDULED_SERVICE",
			campaignKey: SCHEDULER_CAMPAIGN_KEY.TODO_REMINDER,
			variantId: message.variantId,
			title: message.title,
			body: message.body,
			todoId,
			metadata: { stage: stageLabel },
		});

		this.#logger.log(`Reminder sent: todoId=${todoId}, stage=${stageLabel}, userId=${userId}`);
	}
}

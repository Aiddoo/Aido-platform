import { OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Logger } from "@nestjs/common";
import type { Job } from "bullmq";

import { subtractDays } from "@/shared/domain/date/utils/arithmetic";
import { DatabaseService } from "@/shared/infrastructure/database/database.service";

import { NotificationService } from "../../../notification/notification.service";
import { PushDeliveryService } from "../../../notification/push-delivery.service";
import { NotificationMessageBuilder } from "../../../notification/templates/notification-templates";
import {
	type ReminderJobData,
	TODO_REMINDER_QUEUE,
} from "../adapters/bullmq-reminder-scheduler.adapter";

/**
 * BullMQ 리마인더 잡 프로세서
 *
 * - 잡 실행 시 DB에서 투두 유효성 확인 (완료/삭제 여부)
 * - 24시간 내 동일 알림 DB dedup
 * - 알림 발송 (NotificationService)
 */
@Processor(TODO_REMINDER_QUEUE)
export class TodoReminderProcessor extends WorkerHost {
	readonly #logger = new Logger(TodoReminderProcessor.name);

	constructor(
		private readonly database: DatabaseService,
		private readonly notificationService: NotificationService,
		private readonly pushDeliveryService: PushDeliveryService,
	) {
		super();
	}

	@OnWorkerEvent("stalled")
	onStalled(jobId: string) {
		this.#logger.warn(`Job stalled: jobId=${jobId}`);
	}

	@OnWorkerEvent("error")
	onError(error: Error) {
		this.#logger.error(`Worker error: ${error.message}`, error.stack);
	}

	@OnWorkerEvent("failed")
	onFailed(job: Job | undefined, error: Error) {
		this.#logger.error(
			`Job failed: jobId=${job?.id}, name=${job?.name}, error=${error.message}`,
			error.stack,
		);
	}

	async process(job: Job<ReminderJobData>): Promise<void> {
		const { todoId, userId, stageLabel } = job.data;

		this.#logger.debug(
			`Processing reminder: todoId=${todoId}, stage=${stageLabel}`,
		);

		// 1. 투두가 아직 유효한지 확인 (완료/삭제 여부)
		const todo = await this.database.todo.findFirst({
			where: { id: todoId, completed: false },
			select: { id: true, title: true },
		});

		if (!todo) {
			this.#logger.debug(
				`Reminder skipped (todo completed/deleted): todoId=${todoId}`,
			);
			return;
		}

		// 2. 24시간 내 동일 알림 DB dedup
		const twentyFourHoursAgo = subtractDays(1);
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

		// 3. 알림 발송 (DB에서 최신 제목 사용 — 스케줄링 이후 제목 변경 반영)
		// 언어는 UserPreference 캐시 경유 (발송 여부 판정과 같은 캐시 엔트리 공유)
		const locale = await this.pushDeliveryService.getUserLocale(userId);
		const message = NotificationMessageBuilder.todoReminder(
			todo.title,
			stageLabel,
			locale,
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
	}
}

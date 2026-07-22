import {
	Inject,
	Injectable,
	Logger,
	type OnModuleInit,
	Optional,
} from "@nestjs/common";
import {
	JOB_RUNTIME,
	type JobData,
	type JobRuntimePort,
} from "@/shared/application/ports/job-runtime.port";
import {
	fromLegacyJob,
	type NamedJob,
} from "@/shared/infrastructure/jobs/named-job";

import { DispatchDailySignupSummaryUseCase } from "../../application/use-cases/dispatch-daily-signup-summary/dispatch-daily-signup-summary.use-case";
import { SendAdminNotificationUseCase } from "../../application/use-cases/send-admin-notification/send-admin-notification.use-case";
import {
	ADMIN_NOTIFICATION_LEGACY_QUEUE,
	ADMIN_NOTIFICATION_QUEUE,
	type AdminNotificationJobData,
	type AdminNotificationJobMap,
	AdminNotificationJobName,
	type AdminNotificationSendData,
} from "./admin-notification-queue.constants";

/**
 * 관리자 알림 BullMQ Processor (진입 어댑터).
 *
 * - dispatch-signup-summary: 스케줄러 트리거 → DispatchDailySignupSummaryUseCase
 * - send-notification: Discord 웹훅 발송 → SendAdminNotificationUseCase
 *
 * concurrency=3: Discord rate limit (30 req/min/webhook) 대응
 */
type AdminNotificationJob = NamedJob<AdminNotificationJobMap>;
interface AdminNotificationJobLike {
	readonly name: string;
	readonly data: AdminNotificationJobData;
}

@Injectable()
export class AdminNotificationProcessor implements OnModuleInit {
	readonly #logger = new Logger(AdminNotificationProcessor.name);

	constructor(
		private readonly sendAdminNotification: SendAdminNotificationUseCase,
		private readonly dispatchDailySummary: DispatchDailySignupSummaryUseCase,
		@Optional()
		@Inject(JOB_RUNTIME)
		private readonly runtime?: JobRuntimePort,
	) {}

	onStalled(jobId: string) {
		this.#logger.warn(`Job stalled: jobId=${jobId}`);
	}

	onError(error: Error) {
		this.#logger.error(`Worker error: ${error.message}`, error.stack);
	}

	onFailed(
		job: { readonly id?: string; readonly name?: string } | undefined,
		error: Error,
	) {
		this.#logger.error(
			`Job failed: jobId=${job?.id}, name=${job?.name}, error=${error.message}`,
			error.stack,
		);
	}

	async onModuleInit(): Promise<void> {
		if (!this.runtime) return;
		await this.runtime.work<AdminNotificationJob>(
			ADMIN_NOTIFICATION_QUEUE,
			async (jobs) => {
				for (const job of jobs) await this.process(job.data);
			},
			{ teamSize: 3, pollingIntervalSeconds: 2 },
		);
		await this.runtime.work<JobData>(
			ADMIN_NOTIFICATION_LEGACY_QUEUE,
			async (jobs) => {
				for (const job of jobs) {
					await this.process(fromLegacyJob<AdminNotificationJobMap>(job));
				}
			},
			{ teamSize: 3, pollingIntervalSeconds: 2 },
		);
	}

	async process(job: AdminNotificationJobLike): Promise<void> {
		if (job.name === AdminNotificationJobName.DISPATCH_SUMMARY) {
			await this.dispatchDailySummary.execute();
			return;
		}

		if (isSendJob(job)) {
			const { channel, notification } = job.data;
			await this.sendAdminNotification.execute(channel, notification);
			return;
		}

		this.#logger.warn(`Unknown job name: ${job.name}`);
	}
}

/** SEND 잡 여부(잡 이름 기반 내로잉) */
function isSendJob(job: AdminNotificationJobLike): job is {
	readonly name: typeof AdminNotificationJobName.SEND;
	readonly data: AdminNotificationSendData;
} {
	return job.name === AdminNotificationJobName.SEND;
}

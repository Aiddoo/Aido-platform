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

import { TimezoneAwareReminderOrchestrator } from "../../application/services/timezone-aware-reminder.orchestrator";
import {
	TIMEZONE_REMINDER_LEGACY_QUEUE,
	TIMEZONE_REMINDER_QUEUE,
	type TimezoneReminderJobMap,
	TimezoneReminderJobName,
} from "./timezone-reminder-queue.constants";

/**
 * 타임존 리마인더 BullMQ Processor (진입 어댑터).
 *
 * BullMQ Job Scheduler가 매분 생성하는 잡을 받아 오케스트레이터에 위임한다.
 * - sweep-reminders: 매분 스윕
 * - reminder-hour-changed: 리마인더 시간 변경 catch-up
 * - social-digest: 저녁 리마인더 90분 후 소셜 다이제스트
 *
 * 오케스트레이터를 생성자 주입하므로(무버스·무setter) DIP를 지키며,
 * 판별 유니온으로 job.data를 캐스트 없이 좁힌다.
 */
type TimezoneReminderJob = NamedJob<TimezoneReminderJobMap>;

@Injectable()
export class TimezoneReminderProcessor implements OnModuleInit {
	readonly #logger = new Logger(TimezoneReminderProcessor.name);

	constructor(
		private readonly orchestrator: TimezoneAwareReminderOrchestrator,
		@Optional() @Inject(JOB_RUNTIME) private readonly runtime?: JobRuntimePort,
	) {}

	async onModuleInit(): Promise<void> {
		if (!this.runtime) return;
		await this.runtime.work<TimezoneReminderJob>(
			TIMEZONE_REMINDER_QUEUE,
			async (jobs) => {
				for (const job of jobs) await this.process(job.data);
			},
			{ teamSize: 1, pollingIntervalSeconds: 2 },
		);
		await this.runtime.work<JobData>(
			TIMEZONE_REMINDER_LEGACY_QUEUE,
			async (jobs) => {
				for (const job of jobs)
					await this.process(fromLegacyJob<TimezoneReminderJobMap>(job));
			},
			{ teamSize: 1, pollingIntervalSeconds: 2 },
		);
	}

	onStalled(jobId: string): void {
		this.#logger.warn(`Job stalled: jobId=${jobId}`);
	}

	onError(error: Error): void {
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

	async process(job: TimezoneReminderJob): Promise<void> {
		switch (job.name) {
			case TimezoneReminderJobName.SWEEP_REMINDERS:
				this.#logger.debug("Processing timezone reminder sweep...");
				await this.orchestrator.handleMinuteSweep();
				break;
			case TimezoneReminderJobName.REMINDER_HOUR_CHANGED:
				this.#logger.debug(
					`Processing reminder hour changed: userId=${job.data.userId}`,
				);
				await this.orchestrator.handleReminderHourChanged(job.data);
				break;
			case TimezoneReminderJobName.SOCIAL_DIGEST:
				this.#logger.debug(`Processing social digest: tz=${job.data.timezone}`);
				await this.orchestrator.handleSocialDigest(job.data);
				break;
			default: {
				const _exhaustive: never = job;
				void _exhaustive;
			}
		}
	}
}

import { Inject, Injectable } from "@nestjs/common";
import { type HealthIndicatorResult, HealthIndicatorService } from "@nestjs/terminus";

import { ADMIN_NOTIFICATION_QUEUE } from "@/admin-notification/queue";
import { AI_REPORT_QUEUE } from "@/ai-report";
import { AI_SUGGESTION_QUEUE } from "@/ai-suggestion";
import { PUSH_DELIVERY_DEAD_LETTER_QUEUE, PUSH_DELIVERY_QUEUE } from "@/notification/queue";
import { RETENTION_DEAD_LETTER_QUEUE, RETENTION_QUEUE } from "@/retention/queue";
import { TODO_REMINDER_QUEUE } from "@/scheduler";
import { JOB_RUNTIME, type JobRuntimePort } from "@/shared/application/ports/job-runtime.port";
import { withTimeout } from "@/shared/application/utils/with-timeout.util";

const QUEUE_STATS_TIMEOUT_MS = 2_000;
const MONITORED_QUEUES = [
	AI_SUGGESTION_QUEUE,
	AI_REPORT_QUEUE,
	ADMIN_NOTIFICATION_QUEUE,
	TODO_REMINDER_QUEUE,
	PUSH_DELIVERY_QUEUE,
	PUSH_DELIVERY_DEAD_LETTER_QUEUE,
	RETENTION_QUEUE,
	RETENTION_DEAD_LETTER_QUEUE,
] as const;

/**
 * 선택된 durable job backend의 상태를 vendor-neutral 형식으로 노출한다.
 * 큐 장애는 프로세스 재시작으로 해결되지 않으므로 503 대신 degraded로 알린다.
 * 기존 DI 토큰과 health 응답 키 호환을 위해 클래스 이름은 유지한다.
 */
@Injectable()
export class BullHealthIndicator {
	constructor(
		private readonly healthIndicatorService: HealthIndicatorService,
		@Inject(JOB_RUNTIME) private readonly runtime: JobRuntimePort,
	) {}

	async isHealthy(key: string): Promise<HealthIndicatorResult> {
		const indicator = this.healthIndicatorService.check(key);
		try {
			const health = await withTimeout(
				this.runtime.health(MONITORED_QUEUES),
				QUEUE_STATS_TIMEOUT_MS,
				"Job runtime health collection",
			);
			return indicator.up({ ...health });
		} catch {
			return indicator.up({
				degraded: true,
				reason: "job_runtime_health_timeout",
			});
		}
	}
}

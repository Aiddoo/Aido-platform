import { InjectQueue } from "@nestjs/bullmq";
import { Inject, Injectable, Optional } from "@nestjs/common";
import {
	type HealthIndicatorResult,
	HealthIndicatorService,
} from "@nestjs/terminus";
import { ADMIN_NOTIFICATION_QUEUE } from "@/admin-notification";
import { AI_REPORT_QUEUE } from "@/ai-report";
import { AI_SUGGESTION_QUEUE } from "@/ai-suggestion";
import { TODO_REMINDER_QUEUE } from "@/scheduler/reminder/adapters/bullmq-reminder-scheduler.adapter";
import { toErrorMessage } from "@/shared/application/utils/error-message.util";
import { withTimeout } from "@/shared/application/utils/with-timeout.util";
import { REDIS_COMMAND_CLIENT } from "@/shared/infrastructure/redis/redis.constants";

/** 큐 상태 수집 타임아웃 — 초과 시 up + degraded로 응답 */
const QUEUE_STATS_TIMEOUT_MS = 2_000;

/**
 * 헬스 체크에 필요한 최소 큐 계약 (BullMQ Queue가 구조적으로 만족)
 */
export interface QueueHealthSource {
	isPaused(): Promise<boolean>;
	getJobCounts(...types: string[]): Promise<Record<string, number>>;
}

/**
 * ping 게이트에 필요한 최소 Redis 계약
 */
export interface RedisPingSource {
	ping(): Promise<string>;
}

/**
 * BullMQ 큐 헬스 체크 인디케이터
 *
 * 핵심 4개 큐의 상태(일시정지 여부, 잡 카운트)를 모니터링합니다.
 *
 * 절대 down(503)을 만들지 않는다: Redis 다운은 태스크 재시작으로 해결되지
 * 않으므로, ALB/ECS가 멀쩡한 태스크를 죽이지 않도록 장애 시에도
 * `up + degraded: true`로 응답한다. 모니터링/알람은 degraded 필드를 본다.
 *
 * ping 게이트: 큐 API(isPaused/getJobCounts)는 BullMQ 공유 클라이언트
 * (오프라인 큐 유지)를 타므로 Redis 다운 중 호출하면 명령이 무한 대기
 * 상태로 쌓인다. fail-fast 명령용 클라이언트로 먼저 ping해 Redis가
 * 죽어있으면 큐 API를 아예 호출하지 않는다.
 */
@Injectable()
export class BullHealthIndicator {
	constructor(
		private readonly healthIndicatorService: HealthIndicatorService,
		@InjectQueue(AI_SUGGESTION_QUEUE)
		private readonly aiSuggestionQueue: QueueHealthSource,
		@InjectQueue(AI_REPORT_QUEUE)
		private readonly aiReportQueue: QueueHealthSource,
		@InjectQueue(ADMIN_NOTIFICATION_QUEUE)
		private readonly adminNotificationQueue: QueueHealthSource,
		@InjectQueue(TODO_REMINDER_QUEUE)
		private readonly todoReminderQueue: QueueHealthSource,
		@Optional()
		@Inject(REDIS_COMMAND_CLIENT)
		private readonly redis: RedisPingSource | null = null,
	) {}

	async isHealthy(key: string): Promise<HealthIndicatorResult> {
		const indicator = this.healthIndicatorService.check(key);

		if (this.redis) {
			try {
				await this.redis.ping();
			} catch (error) {
				return indicator.up({
					degraded: true,
					reason: `redis unavailable: ${toErrorMessage(error)}`,
				});
			}
		}

		try {
			const results = await withTimeout(
				this.#collectQueueStats(),
				QUEUE_STATS_TIMEOUT_MS,
				"Queue stats collection",
			);
			return indicator.up(results);
		} catch (error) {
			return indicator.up({
				degraded: true,
				reason: toErrorMessage(error),
			});
		}
	}

	async #collectQueueStats(): Promise<Record<string, unknown>> {
		const queues = [
			{ name: "ai-suggestion", queue: this.aiSuggestionQueue },
			{ name: "ai-report", queue: this.aiReportQueue },
			{ name: "admin-notification", queue: this.adminNotificationQueue },
			{ name: "todo-reminder", queue: this.todoReminderQueue },
		];

		const results: Record<string, unknown> = {};
		for (const { name, queue } of queues) {
			const [isPaused, counts] = await Promise.all([
				queue.isPaused(),
				queue.getJobCounts("active", "waiting", "failed"),
			]);
			results[name] = { isPaused, ...counts };
		}

		return results;
	}
}

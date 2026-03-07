import { InjectQueue } from "@nestjs/bullmq";
import { Injectable } from "@nestjs/common";
import {
	type HealthIndicatorResult,
	HealthIndicatorService,
} from "@nestjs/terminus";
import type { Queue } from "bullmq";
import { ADMIN_NOTIFICATION_QUEUE } from "@/modules/admin-notification/queue/admin-notification-queue.constants";
import { AI_REPORT_QUEUE } from "@/modules/ai-report/processors/report-generation.processor";
import { AI_SUGGESTION_QUEUE } from "@/modules/ai-suggestion/processors/suggestion-analysis.processor";
import { TODO_REMINDER_QUEUE } from "@/modules/scheduler/reminder/adapters/bullmq-reminder-scheduler.adapter";

/**
 * BullMQ 큐 헬스 체크 인디케이터
 *
 * 핵심 4개 큐의 상태(일시정지 여부, 잡 카운트)를 모니터링합니다.
 */
@Injectable()
export class BullHealthIndicator {
	constructor(
		private readonly healthIndicatorService: HealthIndicatorService,
		@InjectQueue(AI_SUGGESTION_QUEUE)
		private readonly aiSuggestionQueue: Queue,
		@InjectQueue(AI_REPORT_QUEUE)
		private readonly aiReportQueue: Queue,
		@InjectQueue(ADMIN_NOTIFICATION_QUEUE)
		private readonly adminNotificationQueue: Queue,
		@InjectQueue(TODO_REMINDER_QUEUE)
		private readonly todoReminderQueue: Queue,
	) {}

	async isHealthy(key: string): Promise<HealthIndicatorResult> {
		const indicator = this.healthIndicatorService.check(key);

		try {
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

			return indicator.up(results);
		} catch (error) {
			return indicator.down({ error: (error as Error).message });
		}
	}
}

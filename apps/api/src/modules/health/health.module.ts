import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { ADMIN_NOTIFICATION_QUEUE } from "@/modules/admin-notification/processors/admin-notification.processor";
import { AI_REPORT_QUEUE } from "@/modules/ai-report/processors/report-generation.processor";
import { AI_SUGGESTION_QUEUE } from "@/modules/ai-suggestion/processors/suggestion-analysis.processor";
import { TODO_REMINDER_QUEUE } from "@/modules/scheduler/reminder/adapters/bullmq-reminder-scheduler.adapter";
import { HealthController } from "./health.controller";
import { BullHealthIndicator } from "./indicators/bull.health";
import { DatabaseHealthIndicator } from "./indicators/database.health";

@Module({
	imports: [
		TerminusModule,
		BullModule.registerQueue(
			{ name: AI_SUGGESTION_QUEUE },
			{ name: AI_REPORT_QUEUE },
			{ name: ADMIN_NOTIFICATION_QUEUE },
			{ name: TODO_REMINDER_QUEUE },
		),
	],
	controllers: [HealthController],
	providers: [DatabaseHealthIndicator, BullHealthIndicator],
})
export class HealthModule {}

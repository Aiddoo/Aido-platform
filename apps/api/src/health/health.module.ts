import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { TerminusModule } from "@nestjs/terminus";
import { ADMIN_NOTIFICATION_QUEUE } from "@/admin-notification";
import { AI_REPORT_QUEUE } from "@/ai-report";
import { AI_SUGGESTION_QUEUE } from "@/ai-suggestion";
import { TODO_REMINDER_QUEUE } from "@/scheduler";
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

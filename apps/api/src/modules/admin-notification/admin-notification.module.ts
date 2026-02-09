import { Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";

import { DatabaseModule } from "@/database";

import { DailySignupSummaryJob } from "./jobs/daily-signup-summary.job";
import { UserRegistrationListener } from "./listeners/user-registration.listener";
import { ADMIN_NOTIFIER } from "./providers/admin-notifier.interface";
import { DiscordWebhookProvider } from "./providers/discord-webhook.provider";

@Module({
	imports: [
		EventEmitterModule.forRoot(),
		ScheduleModule.forRoot(),
		DatabaseModule,
	],
	providers: [
		{
			provide: ADMIN_NOTIFIER,
			useClass: DiscordWebhookProvider,
		},
		UserRegistrationListener,
		DailySignupSummaryJob,
	],
})
export class AdminNotificationModule {}

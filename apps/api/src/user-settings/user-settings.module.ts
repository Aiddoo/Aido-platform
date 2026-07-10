import { Module } from "@nestjs/common";

import { AuthModule } from "@/auth/auth.module";
import { NotificationQueueModule } from "@/notification/queue/notification-queue.module";
import { TimezoneReminderQueueModule } from "@/scheduler/queue/timezone-reminder-queue.module";

import { UserConsentRepository } from "./repositories/user-consent.repository";
import { UserPreferenceRepository } from "./repositories/user-preference.repository";
import { StreakService } from "./services/streak.service";
import { UserSettingsService } from "./services/user-settings.service";
import { SettingsController } from "./user-settings.controller";

@Module({
	imports: [AuthModule, NotificationQueueModule, TimezoneReminderQueueModule],
	controllers: [SettingsController],
	providers: [
		UserSettingsService,
		UserPreferenceRepository,
		UserConsentRepository,
		StreakService,
	],
	exports: [UserPreferenceRepository, UserConsentRepository, StreakService],
})
export class UserSettingsModule {}

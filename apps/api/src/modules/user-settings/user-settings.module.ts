import { Module } from "@nestjs/common";

import { AuthModule } from "@/modules/auth/auth.module";
import { TimezoneReminderQueueModule } from "@/modules/scheduler/queue/timezone-reminder-queue.module";

import { UserConsentRepository } from "./repositories/user-consent.repository";
import { UserPreferenceRepository } from "./repositories/user-preference.repository";
import { StreakService } from "./services/streak.service";
import { UserSettingsService } from "./services/user-settings.service";
import { SettingsController } from "./settings.controller";

@Module({
	imports: [AuthModule, TimezoneReminderQueueModule],
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

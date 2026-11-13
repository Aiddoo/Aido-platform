import { Module } from "@nestjs/common";

import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";
import { SocialFriendsModule } from "#api/modules/social/friends/social-friends.public";

import { ReminderNudgeController } from "./presentation/http/v1/reminder-nudge.controller.js";
import { SOCIAL_REMINDER_NUDGES_PROVIDERS } from "./social-reminder-nudges.providers.js";

@Module({
  imports: [SocialFriendsModule, NotificationPushModule],
  controllers: [ReminderNudgeController],
  providers: [...SOCIAL_REMINDER_NUDGES_PROVIDERS],
})
export class SocialReminderNudgesModule {}

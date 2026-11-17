import { Module } from "@nestjs/common";

import { NotificationQueueModule } from "#api/modules/notification/notifications/notification-notifications-jobs.public";
import { PlanningTodosQueriesModule } from "#api/modules/planning/todos/planning-todos-queries.public";
import { SocialFriendshipsModule } from "#api/modules/social/friendships/social-friendships.public";

import { ReminderNudgeController } from "./presentation/http/v1/reminder-nudge.controller.js";
import { SOCIAL_REMINDER_NUDGES_PROVIDERS } from "./social-reminder-nudges.providers.js";

@Module({
  imports: [PlanningTodosQueriesModule, SocialFriendshipsModule, NotificationQueueModule],
  controllers: [ReminderNudgeController],
  providers: [...SOCIAL_REMINDER_NUDGES_PROVIDERS],
})
export class SocialReminderNudgesModule {}

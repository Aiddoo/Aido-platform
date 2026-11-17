import { Module } from "@nestjs/common";

import { NotificationQueueModule } from "#api/modules/notification/notifications/notification-notifications-jobs.public";
import { PlanningTodoQueriesModule } from "#api/modules/planning/todos/planning-todo-queries.public";
import { SocialFriendshipsModule } from "#api/modules/social/friendships/social-friendships.public";

import { ReminderNudgeController } from "./presentation/http/v1/reminder-nudge.controller.js";
import { SOCIAL_REMINDER_NUDGES_PROVIDERS } from "./social-reminder-nudges.providers.js";

@Module({
  imports: [PlanningTodoQueriesModule, SocialFriendshipsModule, NotificationQueueModule],
  controllers: [ReminderNudgeController],
  providers: [...SOCIAL_REMINDER_NUDGES_PROVIDERS],
})
export class SocialReminderNudgesModule {}

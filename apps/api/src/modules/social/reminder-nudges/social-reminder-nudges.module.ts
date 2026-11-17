import { Module } from "@nestjs/common";

import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";
import { PlanningTodoQueriesModule } from "#api/modules/planning/todos/planning-todo-queries.public";
import { SocialFriendshipsModule } from "#api/modules/social/friendships/social-friendships.public";

import { ReminderNudgeController } from "./presentation/http/v1/reminder-nudge.controller.js";
import { SOCIAL_REMINDER_NUDGES_PROVIDERS } from "./social-reminder-nudges.providers.js";

@Module({
  imports: [PlanningTodoQueriesModule, SocialFriendshipsModule, NotificationPushModule],
  controllers: [ReminderNudgeController],
  providers: [...SOCIAL_REMINDER_NUDGES_PROVIDERS],
})
export class SocialReminderNudgesModule {}

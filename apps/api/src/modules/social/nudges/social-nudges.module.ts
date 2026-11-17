import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AccessFeatureGrantsQueriesModule } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { IdentityUserAccessModule } from "#api/modules/identity/users/identity-users.public";
import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";
import { PlanningTodoQueriesModule } from "#api/modules/planning/todos/planning-todo-queries.public";
import { SocialFriendshipsModule } from "#api/modules/social/friendships/social-friendships.public";

import { NudgeCountCachePort } from "./application/ports/nudge-count-cache.port.js";
import { NudgeUsageReaderPort } from "./application/ports/nudge-usage.reader.port.js";
import { NudgeInteractionController } from "./presentation/http/v1/nudge-interaction.controller.js";
import { NudgeController } from "./presentation/http/v1/nudge.controller.js";
import { socialNudgesConfig } from "./social-nudges.config.js";
import { SOCIAL_NUDGES_PROVIDERS } from "./social-nudges.providers.js";

@Module({
  imports: [
    AccessFeatureGrantsQueriesModule,
    IdentityUserAccessModule,
    PlanningTodoQueriesModule,
    SocialFriendshipsModule,
    NotificationPushModule,
    ConfigModule.forFeature(socialNudgesConfig),
  ],
  controllers: [NudgeController, NudgeInteractionController],
  providers: [...SOCIAL_NUDGES_PROVIDERS],
  exports: [NudgeUsageReaderPort, NudgeCountCachePort],
})
export class SocialNudgesModule {}

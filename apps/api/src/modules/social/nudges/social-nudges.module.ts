import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { SocialFriendsModule } from "#api/modules/social/friends/social-friends.public";

import { NudgeUsageReaderPort } from "./application/ports/nudge-usage.reader.port.js";
import { NudgeInteractionController } from "./presentation/http/v1/nudge-interaction.controller.js";
import { NudgeController } from "./presentation/http/v1/nudge.controller.js";
import { socialNudgesConfig } from "./social-nudges.config.js";
import { SOCIAL_NUDGES_PROVIDERS } from "./social-nudges.providers.js";

@Module({
  imports: [
    AccessModule,
    SocialFriendsModule,
    NotificationDeliveryModule,
    ConfigModule.forFeature(socialNudgesConfig),
  ],
  controllers: [NudgeController, NudgeInteractionController],
  providers: [...SOCIAL_NUDGES_PROVIDERS],
  exports: [NudgeUsageReaderPort],
})
export class SocialNudgesModule {}

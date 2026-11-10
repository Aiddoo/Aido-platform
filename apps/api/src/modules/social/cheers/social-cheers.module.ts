import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { SocialFriendsModule } from "#api/modules/social/friends/social-friends.public";

import { CheerUsageReaderPort } from "./application/ports/cheer-usage.reader.port.js";
import { CheerController } from "./presentation/http/v1/cheer.controller.js";
import { SOCIAL_CHEERS_PROVIDERS } from "./social-cheers.providers.js";

@Module({
  imports: [AccessModule, SocialFriendsModule, NotificationDeliveryModule],
  controllers: [CheerController],
  providers: [...SOCIAL_CHEERS_PROVIDERS],
  exports: [CheerUsageReaderPort],
})
export class SocialCheersModule {}

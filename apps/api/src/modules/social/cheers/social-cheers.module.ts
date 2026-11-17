import { Module } from "@nestjs/common";

import { AccessFeatureGrantsQueriesModule } from "#api/modules/access/feature-grants/access-feature-grants.public";
import { NotificationPushModule } from "#api/modules/notification/notification-delivery.public";
import { SocialFriendsModule } from "#api/modules/social/friends/social-friends.public";

import { CheerCountCachePort } from "./application/ports/cheer-count-cache.port.js";
import { CheerUsageReaderPort } from "./application/ports/cheer-usage.reader.port.js";
import { CheerController } from "./presentation/http/v1/cheer.controller.js";
import { SOCIAL_CHEERS_PROVIDERS } from "./social-cheers.providers.js";

@Module({
  imports: [AccessFeatureGrantsQueriesModule, SocialFriendsModule, NotificationPushModule],
  controllers: [CheerController],
  providers: [...SOCIAL_CHEERS_PROVIDERS],
  exports: [CheerUsageReaderPort, CheerCountCachePort],
})
export class SocialCheersModule {}

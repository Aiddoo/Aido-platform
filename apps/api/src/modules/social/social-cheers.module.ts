import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { SocialFriendsModule } from "#api/modules/social/social-friends.public";

import { CHEER_LIMIT_READER } from "./application/ports/cheers/cheer-limit-reader.port.js";
import { CHEER_NOTIFIER } from "./application/ports/cheers/cheer-notifier.port.js";
import { CHEER_REPOSITORY } from "./application/ports/cheers/cheer.repository.port.js";
import { CheerLimitReaderAdapter } from "./infrastructure/adapters/cheers/cheer-limit-reader.adapter.js";
import { CheerNotifierAdapter } from "./infrastructure/adapters/cheers/cheer-notifier.adapter.js";
import { PrismaCheerRepository } from "./infrastructure/persistence/cheers/prisma-cheer.repository.js";
import { CheerController } from "./presentation/controllers/cheers/cheer.controller.js";
import {
  getReceivedCheersProvider,
  getSentCheersProvider,
  getCheerLimitProvider,
  getCheerCooldownProvider,
  markCheerReadProvider,
  markManyCheersReadProvider,
  sendCheerProvider,
} from "./social-cheers-application.providers.js";

@Module({
  imports: [AccessModule, SocialFriendsModule, NotificationDeliveryModule],
  controllers: [CheerController],
  providers: [
    { provide: CHEER_REPOSITORY, useClass: PrismaCheerRepository },
    { provide: CHEER_NOTIFIER, useClass: CheerNotifierAdapter },
    { provide: CHEER_LIMIT_READER, useClass: CheerLimitReaderAdapter },
    getReceivedCheersProvider,
    getSentCheersProvider,
    getCheerLimitProvider,
    getCheerCooldownProvider,
    sendCheerProvider,
    markCheerReadProvider,
    markManyCheersReadProvider,
  ],
})
export class SocialCheersModule {}

import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { NotificationModule } from "#api/modules/notification/notification-delivery.public";
import { SocialFriendsModule } from "#api/modules/social/social-friends.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";

import {
  NUDGE_INTERACTION_CONFIG,
  type NudgeInteractionConfigPort,
} from "./application/ports/nudges/nudge-interaction.config.port.js";
import { NUDGE_LIMIT_READER } from "./application/ports/nudges/nudge-limit-reader.port.js";
import { NUDGE_NOTIFIER } from "./application/ports/nudges/nudge-notifier.port.js";
import { NUDGE_REPOSITORY } from "./application/ports/nudges/nudge.repository.port.js";
import { NudgeLimitReaderAdapter } from "./infrastructure/adapters/nudges/nudge-limit-reader.adapter.js";
import { NudgeNotifierAdapter } from "./infrastructure/adapters/nudges/nudge-notifier.adapter.js";
import { PrismaNudgeRepository } from "./infrastructure/persistence/nudges/prisma-nudge.repository.js";
import { NudgeInteractionController } from "./presentation/controllers/nudges/nudge-interaction.controller.js";
import { NudgeController } from "./presentation/controllers/nudges/nudge.controller.js";
import {
  getNudgeInteractionAvailabilityProvider,
  getNudgeInteractionsProvider,
  getNudgeInteractionProvider,
  getNudgeThanksPreviewProvider,
  markNudgeReadProvider,
  getReceivedNudgesProvider,
  getSentNudgesProvider,
  getNudgeLimitProvider,
  getNudgeCooldownProvider,
  getRemindNudgeCooldownProvider,
  replyToNudgeProvider,
  sendNudgeThanksProvider,
  sendNudgeProvider,
  sendRemindNudgeProvider,
} from "./social-nudges-application.providers.js";

@Module({
  imports: [AccessModule, SocialFriendsModule, NotificationModule],
  controllers: [NudgeController, NudgeInteractionController],
  providers: [
    {
      provide: NUDGE_INTERACTION_CONFIG,
      inject: [TypedConfigService],
      useFactory: (config: TypedConfigService): NudgeInteractionConfigPort => ({
        isEnabled: config.get("NUDGE_INTERACTIONS_ENABLED"),
      }),
    },
    { provide: NUDGE_REPOSITORY, useClass: PrismaNudgeRepository },
    { provide: NUDGE_NOTIFIER, useClass: NudgeNotifierAdapter },
    { provide: NUDGE_LIMIT_READER, useClass: NudgeLimitReaderAdapter },
    getReceivedNudgesProvider,
    getSentNudgesProvider,
    getNudgeLimitProvider,
    getNudgeCooldownProvider,
    getRemindNudgeCooldownProvider,
    sendNudgeProvider,
    sendRemindNudgeProvider,
    markNudgeReadProvider,
    getNudgeInteractionAvailabilityProvider,
    getNudgeInteractionsProvider,
    getNudgeInteractionProvider,
    getNudgeThanksPreviewProvider,
    replyToNudgeProvider,
    sendNudgeThanksProvider,
  ],
})
export class SocialNudgesModule {}

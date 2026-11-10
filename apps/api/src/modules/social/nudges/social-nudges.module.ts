import { Module } from "@nestjs/common";

import { AccessModule } from "#api/modules/access/access-entitlement.public";
import { NotificationDeliveryModule } from "#api/modules/notification/notification-delivery.public";
import { SocialFriendsModule } from "#api/modules/social/friends/social-friends.public";
import { TypedConfigService } from "#api/platform/config/services/config.service";

import { NUDGE_USAGE_READER } from "../cheers/application/ports/daily-send-usage.reader.port.js";
import {
  NUDGE_INTERACTION_CONFIG,
  type NudgeInteractionConfigPort,
} from "./application/ports/nudge-interaction-config.port.js";
import { NUDGE_LIMIT_READER } from "./application/ports/nudge-limit.reader.port.js";
import { NUDGE_NOTIFIER } from "./application/ports/nudge-notifier.port.js";
import { NUDGE_REPOSITORY } from "./application/ports/nudge.repository.port.js";
import { NudgeLimitReaderAdapter } from "./infrastructure/adapters/nudge-limit-reader.adapter.js";
import { NudgeNotifierAdapter } from "./infrastructure/adapters/nudge-notifier.adapter.js";
import { DrizzleNudgeRepository } from "./infrastructure/persistence/drizzle-nudge.repository.js";
import { NudgeInteractionController } from "./presentation/http/v1/nudge-interaction.controller.js";
import { NudgeController } from "./presentation/http/v1/nudge.controller.js";
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
  nudgeUsageReaderProvider,
} from "./social-nudges.providers.js";

@Module({
  imports: [AccessModule, SocialFriendsModule, NotificationDeliveryModule],
  controllers: [NudgeController, NudgeInteractionController],
  providers: [
    nudgeUsageReaderProvider,
    {
      provide: NUDGE_INTERACTION_CONFIG,
      inject: [TypedConfigService],
      useFactory: (config: TypedConfigService): NudgeInteractionConfigPort => ({
        isEnabled: config.nudge.interactionsEnabled,
      }),
    },
    { provide: NUDGE_REPOSITORY, useClass: DrizzleNudgeRepository },
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
  exports: [NUDGE_USAGE_READER],
})
export class SocialNudgesModule {}

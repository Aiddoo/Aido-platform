import { Module } from "@nestjs/common";

import { NotificationModule } from "#api/modules/notification/notification-delivery.public";
import { FollowModule } from "#api/modules/social/social-friends.module";
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
  nudgeReaderProvider,
  replyToNudgeProvider,
  sendNudgeThanksProvider,
  sendNudgeProvider,
  sendRemindNudgeProvider,
} from "./social-nudges-application.providers.js";

/**
 * Nudge 모듈 (DDD 클린아키텍처 · use-case 기반).
 *
 * 친구의 할 일을 콕 찌르거나(sendNudge), 오늘 할 일이 없는 친구를 독촉한다(sendRemindNudge).
 * 컨트롤러는 endpoint별 UseCase와 Reader를 직접 주입한다.
 *
 * 제한 정책:
 * - 콕 찌르기: FREE 하루 3회 / ACTIVE 무제한, 동일 Todo 24시간 쿨다운, 오늘의 공개 할 일만 대상
 * - 리마인드 콕 찌르기: 일일 제한 없음, 동일 친구 1시간 쿨다운, 친구가 오늘 할 일이 없을 때만
 *
 * 기존 전송 알림은 커밋 후 큐에 등록하며, 답장·감사는 같은 UoW에서 알림과 push outbox를 기록한다.
 */
@Module({
  imports: [FollowModule, NotificationModule],
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
    nudgeReaderProvider,
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
export class NudgeModule {}

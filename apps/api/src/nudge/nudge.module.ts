import { Module } from "@nestjs/common";

import { FollowModule } from "#api/follow/follow.module";
import { NotificationModule } from "#api/notification/index";
import { TypedConfigService } from "#api/shared/infrastructure/config/services/config.service";

import {
  NUDGE_INTERACTION_CONFIG,
  type NudgeInteractionConfigPort,
} from "./application/ports/nudge-interaction.config.port.js";
import { NUDGE_LIMIT_READER } from "./application/ports/nudge-limit-reader.port.js";
import { NUDGE_NOTIFIER } from "./application/ports/nudge-notifier.port.js";
import { NUDGE_REPOSITORY } from "./application/ports/nudge.repository.port.js";
import { GetNudgeInteractionAvailabilityUseCase } from "./application/queries/get-nudge-interaction-availability/get-nudge-interaction-availability.use-case.js";
import { GetNudgeInteractionUseCase } from "./application/queries/get-nudge-interaction/get-nudge-interaction.use-case.js";
import { GetNudgeInteractionsUseCase } from "./application/queries/get-nudge-interactions/get-nudge-interactions.use-case.js";
import { GetNudgeThanksPreviewUseCase } from "./application/queries/get-nudge-thanks-preview/get-nudge-thanks-preview.use-case.js";
import { NudgeReader } from "./application/services/nudge.reader.js";
import { MarkNudgeReadUseCase } from "./application/use-cases/mark-nudge-read/mark-nudge-read.use-case.js";
import { ReplyToNudgeUseCase } from "./application/use-cases/reply-to-nudge/reply-to-nudge.use-case.js";
import { SendNudgeThanksUseCase } from "./application/use-cases/send-nudge-thanks/send-nudge-thanks.use-case.js";
import { SendNudgeUseCase } from "./application/use-cases/send-nudge/send-nudge.use-case.js";
import { SendRemindNudgeUseCase } from "./application/use-cases/send-remind-nudge/send-remind-nudge.use-case.js";
import { NudgeLimitReaderAdapter } from "./infrastructure/adapters/nudge-limit-reader.adapter.js";
import { NudgeNotifierAdapter } from "./infrastructure/adapters/nudge-notifier.adapter.js";
import { PrismaNudgeRepository } from "./infrastructure/persistence/prisma-nudge.repository.js";
import { NudgeInteractionController } from "./presentation/nudge-interaction.controller.js";
import { NudgeController } from "./presentation/nudge.controller.js";

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
    NudgeReader,
    SendNudgeUseCase,
    SendRemindNudgeUseCase,
    MarkNudgeReadUseCase,
    GetNudgeInteractionAvailabilityUseCase,
    GetNudgeInteractionsUseCase,
    GetNudgeInteractionUseCase,
    GetNudgeThanksPreviewUseCase,
    ReplyToNudgeUseCase,
    SendNudgeThanksUseCase,
  ],
})
export class NudgeModule {}

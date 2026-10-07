import { Module } from "@nestjs/common";

import { NotificationModule } from "#api/modules/notification/notification-delivery.public";
import { FollowModule } from "#api/modules/social/social-friends.module";

import { CHEER_LIMIT_READER } from "./application/ports/cheers/cheer-limit-reader.port.js";
import { CHEER_NOTIFIER } from "./application/ports/cheers/cheer-notifier.port.js";
import { CHEER_REPOSITORY } from "./application/ports/cheers/cheer.repository.port.js";
import { CheerLimitReaderAdapter } from "./infrastructure/adapters/cheers/cheer-limit-reader.adapter.js";
import { CheerNotifierAdapter } from "./infrastructure/adapters/cheers/cheer-notifier.adapter.js";
import { PrismaCheerRepository } from "./infrastructure/persistence/cheers/prisma-cheer.repository.js";
import { CheerController } from "./presentation/controllers/cheers/cheer.controller.js";
import {
  cheerReaderProvider,
  markCheerReadProvider,
  markManyCheersReadProvider,
  sendCheerProvider,
} from "./social-cheers-application.providers.js";

/**
 * Cheer 모듈 (DDD 클린아키텍처 · use-case 기반).
 *
 * 친구에게 응원 메시지를 보내고 조회한다. 컨트롤러는 endpoint별 UseCase와 Reader를 직접 주입한다.
 * 제한 정책: FREE 하루 3회 / ACTIVE 무제한, 동일 친구 24시간 쿨다운.
 */
@Module({
  imports: [FollowModule, NotificationModule],
  controllers: [CheerController],
  providers: [
    { provide: CHEER_REPOSITORY, useClass: PrismaCheerRepository },
    { provide: CHEER_NOTIFIER, useClass: CheerNotifierAdapter },
    { provide: CHEER_LIMIT_READER, useClass: CheerLimitReaderAdapter },
    cheerReaderProvider,
    sendCheerProvider,
    markCheerReadProvider,
    markManyCheersReadProvider,
  ],
})
export class CheerModule {}

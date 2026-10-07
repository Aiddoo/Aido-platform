import { Module } from "@nestjs/common";

import { NotificationModule } from "#api/notification/index";

import { FOLLOW_CACHE } from "./application/ports/follow-cache.port.js";
import { FOLLOW_NOTIFIER } from "./application/ports/follow-notifier.port.js";
import { FOLLOW_REPOSITORY } from "./application/ports/follow.repository.port.js";
import { SearchUsersUseCase } from "./application/queries/search-users/search-users.use-case.js";
import { FollowReader } from "./application/services/follow.reader.js";
import { FriendshipEffects } from "./application/services/friendship-effects.service.js";
import { AcceptFriendRequestUseCase } from "./application/use-cases/accept-friend-request/accept-friend-request.use-case.js";
import { RejectFriendRequestUseCase } from "./application/use-cases/reject-friend-request/reject-friend-request.use-case.js";
import { RemoveFriendUseCase } from "./application/use-cases/remove-friend/remove-friend.use-case.js";
import { ReorderFriendUseCase } from "./application/use-cases/reorder-friend/reorder-friend.use-case.js";
import { SendFriendRequestByTagUseCase } from "./application/use-cases/send-friend-request-by-tag/send-friend-request-by-tag.use-case.js";
import { SendFriendRequestUseCase } from "./application/use-cases/send-friend-request/send-friend-request.use-case.js";
import { FollowCacheAdapter } from "./infrastructure/adapters/follow-cache.adapter.js";
import { FollowNotifierAdapter } from "./infrastructure/adapters/follow-notifier.adapter.js";
import { PrismaFollowRepository } from "./infrastructure/persistence/prisma-follow.repository.js";
import { FollowController } from "./presentation/follow.controller.js";

/**
 * Follow 모듈 (DDD 클린아키텍처 · use-case 기반).
 *
 * 친구 요청/수락/거절/삭제/순서변경 + 친구·요청 목록 조회를 담당한다.
 * 컨트롤러는 endpoint UseCase를 직접 사용하고 크로스모듈에는 읽기 capability만 공개한다.
 */
@Module({
  imports: [NotificationModule],
  controllers: [FollowController],
  providers: [
    { provide: FOLLOW_REPOSITORY, useClass: PrismaFollowRepository },
    { provide: FOLLOW_CACHE, useClass: FollowCacheAdapter },
    { provide: FOLLOW_NOTIFIER, useClass: FollowNotifierAdapter },
    FollowReader,
    FriendshipEffects,
    SendFriendRequestUseCase,
    SendFriendRequestByTagUseCase,
    AcceptFriendRequestUseCase,
    RejectFriendRequestUseCase,
    RemoveFriendUseCase,
    ReorderFriendUseCase,
    SearchUsersUseCase,
  ],
  exports: [FollowReader],
})
export class FollowModule {}

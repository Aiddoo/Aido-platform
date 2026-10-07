import { Module } from "@nestjs/common";

import { NotificationModule } from "#api/modules/notification/notification-delivery.public";

import { FOLLOW_CACHE } from "./application/ports/friends/follow-cache.port.js";
import { FOLLOW_NOTIFIER } from "./application/ports/friends/follow-notifier.port.js";
import { FOLLOW_REPOSITORY } from "./application/ports/friends/follow.repository.port.js";
import { FollowReader } from "./application/services/friends/follow.reader.js";
import { FollowCacheAdapter } from "./infrastructure/adapters/friends/follow-cache.adapter.js";
import { FollowNotifierAdapter } from "./infrastructure/adapters/friends/follow-notifier.adapter.js";
import { PrismaFollowRepository } from "./infrastructure/persistence/friends/prisma-follow.repository.js";
import { FollowController } from "./presentation/controllers/friends/follow.controller.js";
import {
  acceptFriendRequestProvider,
  followReaderProvider,
  friendshipEffectsProvider,
  rejectFriendRequestProvider,
  removeFriendProvider,
  reorderFriendProvider,
  searchUsersProvider,
  sendFriendRequestByTagProvider,
  sendFriendRequestProvider,
} from "./social-friends-application.providers.js";

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
    followReaderProvider,
    friendshipEffectsProvider,
    sendFriendRequestProvider,
    sendFriendRequestByTagProvider,
    acceptFriendRequestProvider,
    rejectFriendRequestProvider,
    removeFriendProvider,
    reorderFriendProvider,
    searchUsersProvider,
  ],
  exports: [FollowReader],
})
export class FollowModule {}

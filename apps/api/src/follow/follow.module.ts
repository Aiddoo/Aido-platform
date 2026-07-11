import { Module } from "@nestjs/common";

import { NotificationModule } from "@/notification/notification.module";

import { FollowFacade } from "./application/facades/follow.facade";
import { FOLLOW_REPOSITORY } from "./application/ports/follow.repository.port";
import { FOLLOW_CACHE } from "./application/ports/follow-cache.port";
import { FOLLOW_NOTIFIER } from "./application/ports/follow-notifier.port";
import { SearchUsersUseCase } from "./application/queries/search-users/search-users.use-case";
import { FollowReader } from "./application/services/follow.reader";
import { FriendshipEffects } from "./application/services/friendship-effects.service";
import { AcceptFriendRequestUseCase } from "./application/use-cases/accept-friend-request/accept-friend-request.use-case";
import { RejectFriendRequestUseCase } from "./application/use-cases/reject-friend-request/reject-friend-request.use-case";
import { RemoveFriendUseCase } from "./application/use-cases/remove-friend/remove-friend.use-case";
import { ReorderFriendUseCase } from "./application/use-cases/reorder-friend/reorder-friend.use-case";
import { SendFriendRequestUseCase } from "./application/use-cases/send-friend-request/send-friend-request.use-case";
import { SendFriendRequestByTagUseCase } from "./application/use-cases/send-friend-request-by-tag/send-friend-request-by-tag.use-case";
import { FollowCacheAdapter } from "./infrastructure/adapters/follow-cache.adapter";
import { FollowNotifierAdapter } from "./infrastructure/adapters/follow-notifier.adapter";
import { PrismaFollowRepository } from "./infrastructure/persistence/prisma-follow.repository";
import { FollowController } from "./presentation/follow.controller";

/**
 * Follow 모듈 (DDD 클린아키텍처 · use-case 기반).
 *
 * 친구 요청/수락/거절/삭제/순서변경 + 친구·요청 목록 조회를 담당한다.
 * 컨트롤러와 크로스모듈 소비자는 FollowFacade만 주입한다.
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
		FollowFacade,
	],
	exports: [FollowFacade],
})
export class FollowModule {}

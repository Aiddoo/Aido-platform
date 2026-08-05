import { Module } from "@nestjs/common";
import { FollowModule } from "@/follow";
import { DailyCompletionCacheInvalidator } from "./application/events/daily-completion-cache.invalidator";
import { DailyCompletionFacade } from "./application/facades/daily-completion.facade";
import { DAILY_COMPLETION_CACHE } from "./application/ports/daily-completion-cache.port";
import { FRIEND_PORT } from "./application/ports/friend.port";
import { TODO_COMPLETION_REPOSITORY } from "./application/ports/todo-completion.repository.port";
import { DailyCompletionQueryUseCases } from "./application/queries";
import { DailyCompletionCacheAdapter } from "./infrastructure/adapters/daily-completion-cache.adapter";
import { FriendAdapter } from "./infrastructure/adapters/friend.adapter";
import { PrismaTodoCompletionRepository } from "./infrastructure/adapters/prisma-todo-completion.repository";
import { DailyCompletionController } from "./presentation/daily-completion.controller";

/**
 * DailyCompletion 모듈 (클린아키텍처, 읽기 전용)
 *
 * 날짜별 완료 현황(캘린더 물고기 아이콘)을 조회한다. 집계는 포트로 추상화되며
 * 현재 어댑터는 Prisma groupBy로 DB 레벨 집계를 수행한다. 조회 결과는 Redis에
 * 캐싱되고, 투두 쓰기 도메인 이벤트(@OnEvent) 구독으로 무효화된다.
 */
@Module({
	imports: [FollowModule],
	controllers: [DailyCompletionController],
	providers: [
		DailyCompletionFacade,
		{
			provide: TODO_COMPLETION_REPOSITORY,
			useClass: PrismaTodoCompletionRepository,
		},
		{
			provide: DAILY_COMPLETION_CACHE,
			useClass: DailyCompletionCacheAdapter,
		},
		{ provide: FRIEND_PORT, useClass: FriendAdapter },
		DailyCompletionCacheInvalidator,
		...DailyCompletionQueryUseCases,
	],
})
export class DailyCompletionModule {}

import { Module } from "@nestjs/common";

import { SocialFriendsModule } from "#api/modules/social/social-friends.public";

import { DAILY_COMPLETION_CACHE } from "./application/ports/daily-completions/daily-completion-cache.port.js";
import { FRIEND_PORT } from "./application/ports/daily-completions/friend.port.js";
import { TODO_COMPLETION_REPOSITORY } from "./application/ports/daily-completions/todo-completion.repository.port.js";
import { DailyCompletionCacheAdapter } from "./infrastructure/adapters/daily-completions/daily-completion-cache.adapter.js";
import { FriendAdapter } from "./infrastructure/adapters/daily-completions/friend.adapter.js";
import { PrismaTodoCompletionRepository } from "./infrastructure/persistence/daily-completions/prisma-todo-completion.repository.js";
import { DailyCompletionCacheInvalidator } from "./infrastructure/subscribers/daily-completions/daily-completion-cache.invalidator.js";
import { DAILY_COMPLETION_PROVIDERS } from "./insights-daily-completions.providers.js";
import { DailyCompletionController } from "./presentation/controllers/daily-completions/daily-completion.controller.js";

/**
 * DailyCompletion 모듈 (클린아키텍처, 읽기 전용)
 *
 * 날짜별 완료 현황(캘린더 물고기 아이콘)을 조회한다. 집계는 포트로 추상화되며
 * 현재 어댑터는 Prisma groupBy로 DB 레벨 집계를 수행한다. 조회 결과는 Redis에
 * 캐싱되고, 투두 쓰기 도메인 이벤트(@OnEvent) 구독으로 무효화된다.
 */
@Module({
  imports: [SocialFriendsModule],
  controllers: [DailyCompletionController],
  providers: [
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
    ...DAILY_COMPLETION_PROVIDERS,
  ],
})
export class DailyCompletionModule {}

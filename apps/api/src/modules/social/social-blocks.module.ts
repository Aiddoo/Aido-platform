import { Module } from "@nestjs/common";

import { USER_BLOCK_READER } from "./application/ports/blocks/user-block-reader.port.js";
import { USER_BLOCK_REPOSITORY } from "./application/ports/blocks/user-block.repository.port.js";
import { FOLLOW_CACHE } from "./application/ports/friends/follow-cache.port.js";
import { FollowCacheAdapter } from "./infrastructure/adapters/friends/follow-cache.adapter.js";
import { PrismaUserBlockRepository } from "./infrastructure/persistence/blocks/prisma-user-block.repository.js";
import { UserBlockController } from "./presentation/controllers/blocks/user-block.controller.js";
import {
  blockUserProvider,
  getBlockedUsersProvider,
  unblockUserProvider,
} from "./social-blocks-application.providers.js";

/**
 * 사용자 차단 slice.
 *
 * 친구·콕·응원·댓글 slice가 이 모듈의 USER_BLOCK_READER를 소비한다. 반대로 이 모듈은 다른 slice를
 * import하지 않는다. 차단과 함께 끊는 친구 관계는 같은 social Context의 Follow 테이블이라 차단
 * 저장소가 같은 UoW에서 지우고, 친구 캐시는 friends와 같은 keyspace adapter로 비운다.
 */
@Module({
  controllers: [UserBlockController],
  providers: [
    PrismaUserBlockRepository,
    { provide: USER_BLOCK_REPOSITORY, useExisting: PrismaUserBlockRepository },
    { provide: USER_BLOCK_READER, useExisting: PrismaUserBlockRepository },
    { provide: FOLLOW_CACHE, useClass: FollowCacheAdapter },
    blockUserProvider,
    unblockUserProvider,
    getBlockedUsersProvider,
  ],
  exports: [USER_BLOCK_READER],
})
export class SocialBlocksModule {}

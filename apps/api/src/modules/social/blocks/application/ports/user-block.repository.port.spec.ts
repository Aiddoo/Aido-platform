import { describeUserBlockRepositoryContract } from "#test/contracts/social/user-block-repository.contract";
import { InMemoryUserBlockRepository } from "#test/doubles/social/in-memory-user-block.repository";
import {
  USER_BLOCK_FIXTURE_BLOCKED_ID,
  USER_BLOCK_FIXTURE_BLOCKER_ID,
  USER_BLOCK_FIXTURE_OTHER_USER_ID,
} from "#test/fixtures/social/user-block.fixture";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeUserBlockRepositoryContract(
  async () =>
    new InMemoryUserBlockRepository({
      activeUserIds: [
        USER_BLOCK_FIXTURE_BLOCKER_ID,
        USER_BLOCK_FIXTURE_BLOCKED_ID,
        USER_BLOCK_FIXTURE_OTHER_USER_ID,
      ],
    }),
);

import { describeAccessStateReaderContract } from "#test/contracts/access/access-state-reader.contract";
import {
  InMemoryAccessStateReader,
  type InMemoryAccessUser,
} from "#test/doubles/access/in-memory-access-state.reader";
import { createAccessUserFixture } from "#test/fixtures/access/access-user.fixture";

// 같은 계약을 integration에서는 Drizzle reader·저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeAccessStateReaderContract(async () => {
  const users = new Map<string, InMemoryAccessUser>();
  const reader = new InMemoryAccessStateReader(users);
  return {
    reader,
    featureGrantRepository: reader.featureGrants,
    seedFriendGrantRow: async ({ userId, quantity }) => {
      reader.featureGrants.seed(userId, { FRIEND: quantity });
    },
    seedUser: async ({ id, role, subscriptionStatus, subscriptionExpiresAt, isActive }) => {
      users.set(
        id,
        createAccessUserFixture({
          role,
          subscriptionStatus,
          accessDeadline: subscriptionExpiresAt,
          isActive,
        }),
      );
    },
  };
});

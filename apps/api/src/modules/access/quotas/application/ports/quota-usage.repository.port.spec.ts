import { describeQuotaUsageRepositoryContract } from "#test/contracts/access/quota-usage-repository.contract";
import type { InMemoryAccessUser } from "#test/doubles/access/in-memory-access-state.reader";
import { InMemoryQuotaUsageRepository } from "#test/doubles/access/in-memory-quota-usage.repository";
import { createAccessUserFixture } from "#test/fixtures/access/access-user.fixture";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeQuotaUsageRepositoryContract(async () => {
  const users = new Map<string, InMemoryAccessUser>();
  return {
    repository: new InMemoryQuotaUsageRepository(users),
    seedUser: async ({ id, aiUsageCount, aiUsageResetAt }) => {
      users.set(id, createAccessUserFixture({ aiUsageCount, aiUsageResetAt }));
    },
  };
});

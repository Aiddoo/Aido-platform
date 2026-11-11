import { describeUserSubscriptionProjectionRepositoryContract } from "#test/contracts/billing/user-subscription-projection-repository.contract";
import { InMemoryUserSubscriptionProjectionRepository } from "#test/doubles/billing/in-memory-user-subscription-projection.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeUserSubscriptionProjectionRepositoryContract(async () => {
  const repository = new InMemoryUserSubscriptionProjectionRepository([]);
  return {
    repository,
    seedUser: async (input) => repository.seedUser(input),
    readProjection: async (userId) => repository.projections.get(userId) ?? null,
  };
});

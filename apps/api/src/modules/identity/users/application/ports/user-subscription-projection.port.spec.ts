import { describeUserSubscriptionProjectionContract } from "#test/contracts/identity/user-subscription-projection.contract";
import { InMemoryUserSubscriptionProjection } from "#test/doubles/identity/in-memory-user-subscription-projection";

// 같은 계약을 integration에서는 Drizzle 어댑터로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeUserSubscriptionProjectionContract(async () => {
  const projection = new InMemoryUserSubscriptionProjection([]);
  return {
    projection,
    seedUser: async (input) => projection.seedUser(input),
    readProjection: async (userId) => projection.projections.get(userId) ?? null,
  };
});

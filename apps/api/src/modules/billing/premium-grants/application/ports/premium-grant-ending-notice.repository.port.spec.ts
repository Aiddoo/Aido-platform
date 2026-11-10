import { describePremiumGrantEndingNoticeRepositoryContract } from "#test/contracts/billing/premium-grant-ending-notice-repository.contract";
import { InMemoryPremiumGrantEndingNoticeRepository } from "#test/doubles/billing/in-memory-premium-grant-ending-notice.repository";
import { InMemoryPremiumGrantRepository } from "#test/doubles/billing/in-memory-premium-grant.repository";
import { InMemorySubscriptionRepository } from "#test/doubles/billing/in-memory-subscription.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describePremiumGrantEndingNoticeRepositoryContract(async () => {
  const grants = new InMemoryPremiumGrantRepository();
  const subscriptions = new InMemorySubscriptionRepository();
  return {
    repository: new InMemoryPremiumGrantEndingNoticeRepository(grants, subscriptions),
    grants,
    subscriptions,
  };
});

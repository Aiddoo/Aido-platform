import { describeSubscriptionRepositoryContract } from "#test/contracts/billing/subscription-repository.contract";
import { InMemorySubscriptionRepository } from "#test/doubles/billing/in-memory-subscription.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeSubscriptionRepositoryContract(async () => new InMemorySubscriptionRepository());

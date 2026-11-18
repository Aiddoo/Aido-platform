import { describeQuotaChargeRepositoryContract } from "#test/contracts/access/quota-charge-repository.contract";
import { InMemoryQuotaChargeRepository } from "#test/doubles/access/in-memory-quota-charge.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeQuotaChargeRepositoryContract(async () => new InMemoryQuotaChargeRepository());

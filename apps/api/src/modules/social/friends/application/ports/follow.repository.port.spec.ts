import { describeFollowRepositoryContract } from "#test/contracts/social/follow-repository.contract";
import { InMemoryFollowRepository } from "#test/doubles/social/in-memory-follow.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeFollowRepositoryContract(async () => new InMemoryFollowRepository());

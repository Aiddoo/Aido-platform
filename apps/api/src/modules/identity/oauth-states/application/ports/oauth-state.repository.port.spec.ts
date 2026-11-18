import { describeOAuthStateRepositoryContract } from "#test/contracts/identity/oauth-state-repository.contract";
import { InMemoryOAuthStateRepository } from "#test/doubles/identity/in-memory-oauth-state.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeOAuthStateRepositoryContract(async () => new InMemoryOAuthStateRepository());

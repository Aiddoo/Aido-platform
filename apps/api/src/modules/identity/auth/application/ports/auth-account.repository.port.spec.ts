import { describeAuthAccountRepositoryContract } from "#test/contracts/identity/auth-account-repository.contract";
import { InMemoryAuthAccountRepository } from "#test/doubles/identity/in-memory-auth-account.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeAuthAccountRepositoryContract(async () => new InMemoryAuthAccountRepository());

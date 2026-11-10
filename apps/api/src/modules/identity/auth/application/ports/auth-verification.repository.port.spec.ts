import { describeAuthVerificationRepositoryContract } from "#test/contracts/identity/auth-verification-repository.contract";
import { InMemoryAuthVerificationRepository } from "#test/doubles/identity/in-memory-auth-verification.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeAuthVerificationRepositoryContract(async () => new InMemoryAuthVerificationRepository());

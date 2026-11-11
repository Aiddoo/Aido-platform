import { describeAuthSecurityLogRepositoryContract } from "#test/contracts/identity/auth-security-log-repository.contract";
import { InMemoryAuthSecurityLogRepository } from "#test/doubles/identity/in-memory-auth-security-log.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeAuthSecurityLogRepositoryContract(async () => {
  const repository = new InMemoryAuthSecurityLogRepository();
  return { repository, listEntries: async () => repository.entries };
});

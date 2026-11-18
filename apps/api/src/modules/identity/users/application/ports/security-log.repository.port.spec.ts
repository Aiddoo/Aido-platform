import { describeSecurityLogRepositoryContract } from "#test/contracts/identity/security-log-repository.contract";
import { InMemorySecurityLogRepository } from "#test/doubles/identity/in-memory-security-log.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeSecurityLogRepositoryContract(async () => {
  const repository = new InMemorySecurityLogRepository();
  return {
    repository,
    listEntries: async () => repository.entries,
    recordAt: async (entry, recordedAt) => repository.seed(entry, recordedAt),
  };
});

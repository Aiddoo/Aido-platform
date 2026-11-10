import { describeRetentionRepositoryContract } from "#test/contracts/notification/retention-repository.contract";
import { InMemoryRetentionRepository } from "#test/doubles/notification/in-memory-retention.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeRetentionRepositoryContract(async () => {
  const repository = new InMemoryRetentionRepository();
  let sequence = 0;
  return {
    repository,
    givenUser: async (profile) => {
      sequence += 1;
      const userId = `retention-user-${sequence}`;
      repository.givenUser(userId, profile);
      return userId;
    },
    d7ResultOf: async (assignmentId) => repository.d7Results.get(assignmentId) ?? null,
  };
});

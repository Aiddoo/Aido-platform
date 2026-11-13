import { describeNudgeRepositoryContract } from "#test/contracts/social/nudge-repository.contract";
import { InMemoryNudgeReader } from "#test/doubles/social/in-memory-nudge.reader";
import { InMemoryNudgeRepository } from "#test/doubles/social/in-memory-nudge.repository";

// 같은 계약을 integration에서는 Drizzle 저장소·조회로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeNudgeRepositoryContract(async () => {
  const repository = new InMemoryNudgeRepository();
  return {
    repository,
    reader: new InMemoryNudgeReader(repository),
    addTodo: (seed) => repository.addTodo(seed),
  };
});

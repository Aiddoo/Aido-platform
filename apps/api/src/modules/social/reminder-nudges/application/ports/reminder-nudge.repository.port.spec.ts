import { describeReminderNudgeRepositoryContract } from "#test/contracts/social/reminder-nudge-repository.contract";
import { InMemoryReminderNudgeRepository } from "#test/doubles/social/in-memory-reminder-nudge.repository";
import { InMemoryReminderTargetReader } from "#test/doubles/social/in-memory-reminder-target.reader";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeReminderNudgeRepositoryContract(async () => {
  const targetReader = new InMemoryReminderTargetReader();
  return {
    repository: new InMemoryReminderNudgeRepository(),
    targetReader,
    addTodo: (seed) => targetReader.addTodo(seed),
  };
});

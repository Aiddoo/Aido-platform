import { describeDailyCompletionRepositoryContract } from "#test/contracts/insights/daily-completion-repository.contract";
import { InMemoryDailyCompletionRepository } from "#test/doubles/insights/in-memory-daily-completion.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeDailyCompletionRepositoryContract(
  async (todos) => new InMemoryDailyCompletionRepository(todos),
);

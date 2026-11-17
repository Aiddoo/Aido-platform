import { describeSuggestionAnalysisRunRepositoryContract } from "#test/contracts/ai-assistance/suggestion-analysis-run-repository.contract";
import { InMemorySuggestionAnalysisRunRepository } from "#test/doubles/ai-assistance/in-memory-suggestion-analysis-run.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeSuggestionAnalysisRunRepositoryContract(
  async () => new InMemorySuggestionAnalysisRunRepository(),
);

import { describeSuggestionRepositoryContract } from "#test/contracts/ai-assistance/suggestion-repository.contract";
import { InMemorySuggestionRepository } from "#test/doubles/ai-assistance/in-memory-suggestion.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeSuggestionRepositoryContract(async () => new InMemorySuggestionRepository());

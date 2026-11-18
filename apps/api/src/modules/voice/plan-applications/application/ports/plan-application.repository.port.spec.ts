import { describePlanApplicationRepositoryContract } from "#test/contracts/voice/plan-application-repository.contract";
import { InMemoryPlanApplicationRepository } from "#test/doubles/voice/in-memory-plan-application.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describePlanApplicationRepositoryContract(async () => new InMemoryPlanApplicationRepository());

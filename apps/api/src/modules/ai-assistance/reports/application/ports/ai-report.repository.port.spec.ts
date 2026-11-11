import { describeAiReportRepositoryContract } from "#test/contracts/ai-assistance/ai-report-repository.contract";
import { InMemoryAiReportRepository } from "#test/doubles/ai-assistance/in-memory-ai-report.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeAiReportRepositoryContract(async () => new InMemoryAiReportRepository());

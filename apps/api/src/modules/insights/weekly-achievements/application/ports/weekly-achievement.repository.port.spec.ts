import { describeWeeklyAchievementRepositoryContract } from "#test/contracts/insights/weekly-achievement-repository.contract";
import { InMemoryWeeklyAchievementRepository } from "#test/doubles/insights/in-memory-weekly-achievement.repository";

// 같은 계약을 integration에서는 Drizzle 저장소로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeWeeklyAchievementRepositoryContract(async () => new InMemoryWeeklyAchievementRepository());

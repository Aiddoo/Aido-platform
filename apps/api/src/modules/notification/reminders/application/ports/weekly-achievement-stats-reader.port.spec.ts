import { describeWeeklyAchievementStatsReaderContract } from "#test/contracts/notification/weekly-achievement-stats-reader.contract";
import { InMemoryWeeklyAchievementStatsReader } from "#test/doubles/notification/in-memory-weekly-achievement-stats.reader";

// 같은 계약을 integration에서는 Drizzle 리더로 돌려 테스트 대역이 실제와 같게 움직이는지 지킨다
describeWeeklyAchievementStatsReaderContract(async () => {
  const reader = new InMemoryWeeklyAchievementStatsReader();
  return { reader, givenUser: (seed) => reader.givenUser(seed) };
});

/**
 * 다른 Context(notification 주간 리마인더)에는 주간 기록 쓰기 포트만 연다.
 * Symbol 토큰은 notification이 클래스 토큰으로 옮길 때까지 같은 인스턴스를 가리키는 별칭이다.
 */
export {
  WEEKLY_ACHIEVEMENT_WRITER,
  WeeklyAchievementWriterPort,
} from "./application/ports/weekly-achievement-writer.port.js";
export { InsightsWeeklyAchievementsModule } from "./insights-weekly-achievements.module.js";

import type { WeeklyAchievementRepositoryPort } from "@/weekly-achievement/application/ports/weekly-achievement.repository.port";

/**
 * WEEKLY_ACHIEVEMENT_REPOSITORY 포트 mock 팩토리.
 *
 * @suites/unit은 Symbol 토큰 주입 포트를 auto-mock하지 못하므로 명시적 팩토리를 둡니다.
 * 포트 확장 시 누락을 타입 에러로 잡습니다. 메서드 mock API는 `jest.mocked(mock.method)`로 접근합니다.
 */
export function createWeeklyAchievementRepositoryMock(): WeeklyAchievementRepositoryPort {
	return {
		findByYear: jest.fn(),
		findAllByYear: jest.fn(),
		findByYearAndWeek: jest.fn(),
		upsertMany: jest.fn(),
	};
}

export const STREAK_PORT = Symbol("STREAK_PORT");

/**
 * 스트릭 갱신 포트 (user-settings 컨텍스트 경계)
 *
 * 완료/미완료 토글 시 스트릭을 갱신합니다(fire-and-forget).
 */
export interface StreakPort {
	/** 완료/미완료 전이를 스트릭에 기록합니다. */
	recordTodoToggle(userId: string, completed: boolean, timezone: string): void;

	/** 현재 연속 달성 일수를 조회합니다 (기록 없으면 0). */
	getCurrentStreak(userId: string): Promise<number>;
}

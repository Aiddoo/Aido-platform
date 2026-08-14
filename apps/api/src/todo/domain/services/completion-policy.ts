/** todo 컨텍스트가 발생시키는 완료 마일스톤 (도메인 소유 어휘) */
export type TodoCompletionMilestone = "FIRST_COMPLETE" | "COUNT_10" | "COUNT_50" | "COUNT_100";

/** 누적 완료 카운트 → 마일스톤 매핑 (도메인 정책) */
const COMPLETION_MILESTONES: ReadonlyMap<number, TodoCompletionMilestone> = new Map([
	[1, "FIRST_COMPLETE"],
	[10, "COUNT_10"],
	[50, "COUNT_50"],
	[100, "COUNT_100"],
]);

/**
 * 누적 완료 개수가 마일스톤에 해당하면 그 유형을, 아니면 null을 반환합니다.
 * (정확 일치 — 지나친 카운트는 재발화하지 않음)
 */
export function milestoneForCount(completedCount: number): TodoCompletionMilestone | null {
	return COMPLETION_MILESTONES.get(completedCount) ?? null;
}

/**
 * "오늘 할 일 전체 완료" 판정 (친구 완료 알림 트리거 규칙).
 * 할 일이 하나도 없는 날은 완료로 치지 않습니다.
 */
export function isAllCompletedToday(stats: { total: number; completed: number }): boolean {
	return stats.total > 0 && stats.total === stats.completed;
}

/**
 * 오늘 완료 진행 요약 (홈 위젯 요약 규칙).
 * daily-completion 도메인과 동일 규칙: 완료율 = round(완료/전체 × 100),
 * 할 일이 없는 날은 완료율 0이며 완료로 치지 않습니다.
 */
export function summarizeCompletion(stats: { total: number; completed: number }): {
	completionRate: number;
	isComplete: boolean;
} {
	return {
		completionRate: stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0,
		isComplete: isAllCompletedToday(stats),
	};
}

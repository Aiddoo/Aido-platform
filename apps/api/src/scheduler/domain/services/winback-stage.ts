/**
 * Win-back 단계 정책 (순수 도메인).
 *
 * 미접속 경과일에 따라 재유입 알림 단계를 결정한다.
 */

/** Win-back 단계 정의 (threshold 내림차순, .find()로 첫 매칭 사용) */
export const WINBACK_STAGES = [
	{ threshold: 30, stage: "day30" },
	{ threshold: 21, stage: "day21" },
	{ threshold: 14, stage: "day14" },
	{ threshold: 7, stage: "day7" },
	{ threshold: 0, stage: "day3" },
] as const;

/** 미접속 경과일 → 단계 라벨 (매칭 없으면 최소 단계 day3) */
export function resolveWinbackStage(inactiveDays: number): string {
	const matched = WINBACK_STAGES.find((s) => inactiveDays >= s.threshold);
	return matched?.stage ?? "day3";
}

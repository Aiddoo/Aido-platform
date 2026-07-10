import type { NotificationAction } from "@aido/validators";

/**
 * 브로드캐스트 발송 결과 (성공/실패/총 대상 수)
 */
export interface BroadcastResult {
	successCount: number;
	failCount: number;
	totalTargets: number;
}

/** 총 대상 수와 성공 수로부터 결과 값을 조립한다 (실패 수 = 총 - 성공) */
export function buildBroadcastResult(
	totalTargets: number,
	successCount: number,
): BroadcastResult {
	return {
		successCount,
		failCount: totalTargets - successCount,
		totalTargets,
	};
}

/** 알림 메타데이터 — 외부 URL 액션이 있을 때만 부여 */
export type BroadcastMetadata = { externalUrl: string } | undefined;

/** 액션에 외부 URL이 있으면 externalUrl 메타데이터를 파생한다 */
export function deriveBroadcastMetadata(
	action?: NotificationAction,
): BroadcastMetadata {
	return action?.url ? { externalUrl: action.url } : undefined;
}

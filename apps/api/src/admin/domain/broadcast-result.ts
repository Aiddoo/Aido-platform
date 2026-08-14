/**
 * 브로드캐스트 발송 결과 (성공/실패/총 대상 수)
 */
export interface BroadcastResult {
	successCount: number;
	failCount: number;
	totalTargets: number;
}

/** 총 대상 수와 성공 수로부터 결과 값을 조립한다 (실패 수 = 총 - 성공) */
export function buildBroadcastResult(totalTargets: number, successCount: number): BroadcastResult {
	return {
		successCount,
		failCount: totalTargets - successCount,
		totalTargets,
	};
}

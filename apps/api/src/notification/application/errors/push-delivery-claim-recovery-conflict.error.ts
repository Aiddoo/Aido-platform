/** 마지막 queue attempt의 claim 실패 복구가 일부 fence만 소유한 경우 전체 rollback을 요청한다. */
export class PushDeliveryClaimRecoveryConflictError extends Error {
	constructor(
		readonly expectedCount: number,
		readonly recoveredCount: number,
	) {
		super(
			`Push delivery claim recovery fence mismatch: expected=${expectedCount}, recovered=${recoveredCount}`,
		);
		this.name = PushDeliveryClaimRecoveryConflictError.name;
	}
}

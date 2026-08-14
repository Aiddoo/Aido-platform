export const RETENTION_ENROLLMENT = Symbol("RETENTION_ENROLLMENT");

/** auth가 신규 사용자 리텐션 실험 등록과 시작에 사용하는 capability. */
export interface RetentionEnrollmentPort {
	enrollNewUser(userId: string, isActivated: boolean): Promise<void>;
	activateNewUser(userId: string): Promise<void>;
}

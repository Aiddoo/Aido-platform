export const RETENTION_ENROLLER = Symbol("RETENTION_ENROLLER");

/** 신규 User 생성 트랜잭션에서만 호출되는 리텐션 실험 등록 ACL. */
export interface RetentionEnrollerPort {
	enrollNewUser(userId: string, activated: boolean): Promise<void>;
	activateNewUser(userId: string): Promise<void>;
}

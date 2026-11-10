/** 신규 User 생성 트랜잭션에서만 호출되는 리텐션 실험 등록 ACL. */
export abstract class RetentionEnrollerPort {
  abstract enrollNewUser(userId: string, activated: boolean): Promise<void>;
  abstract activateNewUser(userId: string): Promise<void>;
}

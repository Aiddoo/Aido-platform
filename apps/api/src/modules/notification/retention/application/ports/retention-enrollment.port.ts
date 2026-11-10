// identity가 신규 사용자를 리텐션 실험에 등록하고 첫 인증 때 시작한다
export abstract class RetentionEnrollmentPort {
  abstract enrollNewUser(userId: string, isActivated: boolean): Promise<void>;
  abstract activateNewUser(userId: string): Promise<void>;
}

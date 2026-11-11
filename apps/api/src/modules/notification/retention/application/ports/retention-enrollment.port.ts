import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

// identity가 신규 사용자를 리텐션 실험에 등록하고 첫 인증 때 시작한다
export abstract class RetentionEnrollmentPort {
  abstract enrollNewUser(userId: UserId, isActivated: boolean): Promise<void>;
  abstract activateNewUser(userId: UserId): Promise<void>;
}

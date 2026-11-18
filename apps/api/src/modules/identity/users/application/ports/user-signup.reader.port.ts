import type { UserId } from "#api/shared/domain/identifiers/user-id.vo";

import type {
  SignupCountReadModel,
  UserSignupReadModel,
} from "../read-models/user-signup.read-model.js";

// 다른 Context(운영 알림)가 사용자·로그인 수단 테이블을 직접 읽지 않고 가입 정보를 받는 조회 포트다
export abstract class UserSignupReaderPort {
  /** 탈퇴 대기 중이거나 없는 사용자면 null */
  abstract findSignup(userId: UserId): Promise<UserSignupReadModel | null>;
  /** [start, end)에 만든 사용자를 처음 만든 로그인 수단별로 센다. 기존 사용자가 연결한 수단은 세지 않는다 */
  abstract countSignupsByMethod(period: {
    readonly start: Temporal.Instant;
    readonly end: Temporal.Instant;
  }): Promise<SignupCountReadModel[]>;
  /** 로그인 수단이 있고 탈퇴 대기가 아닌 사용자 수. 로그인 수단이 없는 플랫폼 내부 사용자는 빠진다 */
  abstract countRegisteredUsers(): Promise<number>;
}

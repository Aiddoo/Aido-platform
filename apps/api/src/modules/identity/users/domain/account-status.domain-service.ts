import { accountLocked, accountSuspended } from "./users.errors.js";

// 로그인·세션 확인·인증 메일이 같은 상태 게이트를 쓴다. LOCKED로 바꾸는 행동은 없고 운영이 넣은 행만 거절한다.
// ACTIVE·PENDING_VERIFY는 통과시키고 메일 인증 전 처리는 부르는 흐름이 정한다
export function assertStatusAllowsLogin(
  status: string,
  identifier: string,
  isDeleted = false,
): void {
  if (status === "LOCKED") {
    throw accountLocked(identifier);
  }
  if (status === "SUSPENDED" || isDeleted) {
    throw accountSuspended(identifier);
  }
}

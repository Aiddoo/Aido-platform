import type { SessionId } from "#api/modules/identity/sessions/identity-sessions.public";

// identity가 로그인 세션을 폐기한 뒤 그 세션의 기기를 푸시 대상에서 뺀다
export abstract class SessionPushDeviceReleasePort {
  abstract releaseSessions(sessionIds: readonly SessionId[]): Promise<void>;
}

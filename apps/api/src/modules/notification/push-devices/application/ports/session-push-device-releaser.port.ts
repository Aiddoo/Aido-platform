import type { SessionId } from "#api/modules/identity/sessions/identity-sessions.public";

// identity가 폐기한 세션의 기기를 푸시 대상에서 뺀다. 실패해도 세션 폐기를 막지 않는다
export abstract class SessionPushDeviceReleaserPort {
  abstract releaseSessions(sessionIds: readonly SessionId[]): Promise<void>;
}

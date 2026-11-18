import type { SessionId } from "../../domain/session-id.vo.js";

/** 폐기한 세션의 기기를 푸시 대상에서 빼는 ACL. 실패해도 인증 흐름을 막지 않는다. */
export abstract class SessionPushDeviceReleaserPort {
  abstract releaseSessions(sessionIds: readonly SessionId[]): Promise<void>;
}

export const SESSION_PUSH_DEVICE_RELEASER = Symbol("SESSION_PUSH_DEVICE_RELEASER");

/** 폐기한 세션의 기기를 푸시 대상에서 빼는 ACL. 실패해도 인증 흐름을 막지 않는다. */
export interface SessionPushDeviceReleaserPort {
  releaseSessions(sessionIds: readonly string[]): Promise<void>;
}

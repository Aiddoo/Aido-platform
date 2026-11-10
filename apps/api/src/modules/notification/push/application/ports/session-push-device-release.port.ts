export const SESSION_PUSH_DEVICE_RELEASE = Symbol("SESSION_PUSH_DEVICE_RELEASE");

/** identity가 로그인 세션을 폐기한 뒤 그 세션의 기기를 푸시 대상에서 빼는 capability. */
export interface SessionPushDeviceReleasePort {
  releaseSessions(sessionIds: readonly string[]): Promise<void>;
}

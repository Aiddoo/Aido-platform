// 다른 Context가 옮길 때까지 옛 Symbol을 같은 인스턴스의 별칭으로 남긴다
export const SESSION_PUSH_DEVICE_RELEASE = Symbol("SESSION_PUSH_DEVICE_RELEASE");

// identity가 로그인 세션을 폐기한 뒤 그 세션의 기기를 푸시 대상에서 뺀다
export abstract class SessionPushDeviceReleasePort {
  abstract releaseSessions(sessionIds: readonly string[]): Promise<void>;
}

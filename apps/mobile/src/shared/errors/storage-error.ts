/** 일시적 잠김만 이 타입으로 승격한다. 영구 오류는 원본 그대로 전파해야 관측·폴백할 수 있고, "값 없음"(null)과 구분해야 잠긴 키체인이 로그아웃이 되지 않는다 */
export class KeychainLockedError extends Error {
  override readonly name = 'KeychainLockedError';
  override readonly cause: unknown;

  constructor(cause: unknown) {
    super('Keychain is temporarily unavailable (device locked).');
    this.cause = cause;
  }
}

export function isKeychainLockedError(error: unknown): error is KeychainLockedError {
  return error instanceof KeychainLockedError;
}

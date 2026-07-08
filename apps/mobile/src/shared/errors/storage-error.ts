/**
 * 키체인을 **지금** 읽을 수 없다는 신호. "값이 없다"(`null`)와 구분된다.
 *
 * 기기 잠금 중 콜드 스타트(푸시·백그라운드 실행)에서 발생한다.
 * 이를 "토큰 없음"으로 확정하면 잠긴 키체인이 곧 로그아웃이 된다.
 *
 * **일시적 오류만 이 타입으로 승격한다.** 영구 오류(키체인 손상, entitlement 오설정 등)는
 * 원본 오류 그대로 전파해야 상위에서 관측하고 안전하게 폴백할 수 있다.
 * 모든 읽기 실패를 "잠김"으로 뭉개면 앱이 조용히 무한 로딩에 갇힌다.
 *
 * `InfraError`를 상속하지 않는다 — 그쪽은 `statusCode`를 갖는 HTTP 계열이고
 * ErrorBoundary가 처리하는 의미론이다. 잠김은 화면에 띄울 오류가 아니라 재시도할 상태다.
 */
export class KeychainLockedError extends Error {
  override readonly name = 'KeychainLockedError';

  constructor(override readonly cause: unknown) {
    super('Keychain is temporarily unavailable (device locked).');
  }
}

/** `KeychainLockedError` 타입 가드 */
export const isKeychainLockedError = (error: unknown): error is KeychainLockedError =>
  error instanceof KeychainLockedError;

/**
 * 키체인을 **지금** 읽을 수 없다는 신호. "값이 없다"(null)와 구분된다.
 *
 * 기기 잠금 중 콜드 스타트(푸시·백그라운드 실행)에서 발생한다.
 * 이를 "토큰 없음"으로 확정하면 잠긴 키체인이 곧 로그아웃이 된다.
 *
 * **일시적 오류만 이 타입으로 승격한다.** 영구 오류(키체인 손상, entitlement 오설정 등)는
 * 원본 에러 그대로 전파해야 상위에서 관측하고 안전하게 폴백할 수 있다.
 * 모든 읽기 실패를 "잠김"으로 뭉개면 앱이 조용히 무한 로딩에 갇힌다.
 */
export class KeychainLockedError extends Error {
  override readonly name = 'KeychainLockedError';

  constructor(override readonly cause: unknown) {
    super('Keychain is temporarily unavailable (device locked).');
  }
}

export interface Storage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
  clear(): Promise<void>;
}

export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
}

// 구현체만 토큰 키 이름을 안다. 다른 레이어가 키를 참조하면 저장 계약이 흩어져 변경이 전체 강제 로그아웃으로 번진다
// 읽기 실패는 null이 아니라 throw다. "토큰 없음"과 "지금 읽을 수 없음"을 혼동하면 살아있는 세션을 끝낸다
export interface TokenStore {
  getAccessToken(): Promise<string | null>;
  /** 세션 존재의 근거. 액세스 토큰은 만료돼도 이것으로 재발급된다. @throws 키체인 접근 실패 시 */
  getRefreshToken(): Promise<string | null>;
  /** 부른 즉시 다음 읽기가 새 토큰을 돌려준다. 키체인 쓰기가 늦거나 실패해도 이 실행 동안은 같다(갱신은 쓰기를 기다리지 않는다). @throws 쓰기 실패 시 */
  save(tokens: AuthTokenPair): Promise<void>;
  clear(): Promise<void>;
}

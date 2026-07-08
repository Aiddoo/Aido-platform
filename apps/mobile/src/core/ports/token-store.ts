export interface AuthTokenPair {
  accessToken: string;
  refreshToken: string;
}

/**
 * 인증 토큰 쌍의 영속 저장소.
 *
 * 구현체는 토큰 키 이름을 아는 **유일한 곳**이다. 다른 레이어가 키를 직접 참조하면
 * 저장 계약이 흩어져, 키/옵션 변경이 전체 강제 로그아웃으로 번진다(v1.4.0 사고).
 *
 * 읽기 실패는 `null`이 아니라 **throw**로 표현한다.
 * "토큰이 없다"(로그아웃 상태)와 "지금 읽을 수 없다"(기기 잠김 등)를 혼동하면
 * 살아있는 세션을 잘못 끝내게 된다.
 */
export interface TokenStore {
  /** @throws 키체인 접근 실패 시 */
  readAccessToken(): Promise<string | null>;
  /** 세션 존재의 근거. 액세스 토큰은 만료돼도 이것으로 재발급된다. @throws 키체인 접근 실패 시 */
  readRefreshToken(): Promise<string | null>;
  save(tokens: AuthTokenPair): Promise<void>;
  clear(): Promise<void>;
}

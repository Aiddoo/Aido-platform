/** "판정 전"(loading)은 판정의 결과가 아니라 부재라 여기 없다. `locked`는 "토큰 없음"이 아니라 "지금 읽을 수 없음"이라, 합치면 잠긴 키체인이 로그아웃이 된다 */
export type ResolvedAuthStatus = 'authenticated' | 'unauthenticated' | 'locked';

/** `loading`은 판정 결과가 아니라 결과가 아직 도착하지 않았다는 UI 사정이라 부팅 판정 함수는 반환할 수 없다 */
export type AuthStatus = 'loading' | ResolvedAuthStatus;

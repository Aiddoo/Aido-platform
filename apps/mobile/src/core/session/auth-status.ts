/**
 * 부팅 판정이 내려진 뒤의 인증 상태.
 *
 * "판정 전"(로딩)은 여기 없다 — 그것은 판정의 *결과*가 아니라 결과의 *부재*이며,
 * `resolveInitialAuthStatus`는 결코 그 값을 반환할 수 없다. 상태 머신 쪽에서만 존재한다.
 *
 * `locked`는 "토큰이 없다"가 아니라 **"지금 읽을 수 없다"**이다(기기 잠금 중 콜드 스타트 등).
 * 둘을 합치면 잠긴 키체인이 곧 로그아웃이 된다.
 */
export type ResolvedAuthStatus = 'authenticated' | 'unauthenticated' | 'locked';

/**
 * 인증 상태 머신 = 아직 판정 전(`loading`) 또는 판정 결과(`ResolvedAuthStatus`).
 *
 * `loading`만 여기 따로 있는 이유: 부팅 판정 함수는 이 값을 반환할 수 없다.
 * 판정 결과가 아니라 결과가 아직 도착하지 않았다는 UI 사정이기 때문이다.
 */
export type AuthStatus = 'loading' | ResolvedAuthStatus;

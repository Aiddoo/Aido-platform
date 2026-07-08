import type { TokenStore } from '@src/core/ports/token-store';
import { isKeychainLockedError } from '@src/shared/errors';

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
 * 앱 부팅 시 초기 인증 상태를 결정한다.
 *
 * **불변식**: 부팅 경로는 토큰을 읽기만 한다. 지우지 않고, 네트워크를 타지 않는다.
 *
 * - 로컬 휴리스틱(첫 실행 플래그·앱 버전)으로 "재설치"를 추측하지 않는다.
 *   플래그 부재는 "재설치"와 "그 키가 없던 구버전에서의 업데이트"를 구분하지 못한다
 *   (v1.4.0 전체 강제 로그아웃 사고의 원인).
 * - 부팅을 네트워크 결과에 걸지 않는다. 걸면 서버 장애가 곧 로그아웃이 된다.
 *   세션 검증은 첫 인증 요청의 401 경로가 알아서 수행한다.
 *
 * 세션 존재의 근거는 **리프레시 토큰**이다 — 액세스 토큰은 만료돼도 재발급된다.
 *
 * @throws 잠금이 아닌 읽기 실패(키체인 손상, entitlement 오설정 등)는 그대로 던진다.
 *   이를 `locked`로 뭉개면 재판정도 계속 실패해 앱이 **조용히 무한 로딩**에 갇힌다.
 *   호출자가 관측하고 미인증으로 폴백해야 한다(토큰은 지우지 않으므로 다음 실행에 회복 가능).
 */
export const resolveInitialAuthStatus = async (
  tokenStore: TokenStore,
): Promise<ResolvedAuthStatus> => {
  try {
    const refreshToken = await tokenStore.readRefreshToken();
    return refreshToken ? 'authenticated' : 'unauthenticated';
  } catch (error) {
    if (isKeychainLockedError(error)) {
      return 'locked';
    }
    throw error;
  }
};

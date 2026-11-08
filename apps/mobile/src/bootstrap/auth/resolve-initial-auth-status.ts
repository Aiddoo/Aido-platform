import type { TokenStore } from '@src/core/ports/token-store';
import type { ResolvedAuthStatus } from '@src/core/session/auth-status';
import { isKeychainLockedError } from '@src/shared/errors';

// 부팅 경로는 토큰을 읽기만 한다. 첫 실행 플래그·앱 버전으로 재설치를 추측하지 않고(구버전 업데이트와 구분할 수 없다), 부팅을 네트워크에 걸지 않는다
// 잠금이 아닌 읽기 실패는 `locked`로 뭉개지 않고 던진다. 재판정도 계속 실패해 조용히 무한 로딩에 갇히기 때문이다
export async function resolveInitialAuthStatus(
  tokenStore: TokenStore,
): Promise<ResolvedAuthStatus> {
  try {
    const refreshToken = await tokenStore.getRefreshToken();
    return refreshToken ? 'authenticated' : 'unauthenticated';
  } catch (error) {
    if (isKeychainLockedError(error)) {
      return 'locked';
    }
    throw error;
  }
}

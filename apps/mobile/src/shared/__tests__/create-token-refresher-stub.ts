import type { RefreshOutcome, TokenRefresher } from '@src/core/ports/token-refresher';

/** 호출마다 새 액세스 토큰을 받은 것으로 끝난다 */
export function createTokenRefresherStub(): jest.MockedFunction<TokenRefresher> {
  const refreshed: RefreshOutcome = { kind: 'refreshed', accessToken: 'refreshed-access-token' };

  return jest.fn(async () => refreshed);
}

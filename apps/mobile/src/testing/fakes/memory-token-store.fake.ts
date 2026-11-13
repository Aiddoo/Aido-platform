import type { AuthTokenPair, TokenStore } from '@src/core/ports/token-store';

/**
 * 호출 여부 대신 결과 상태를 확인하는 토큰 저장소 fake.
 * 실제 저장소처럼 저장·삭제가 다음 읽기에 반영되어 회전과 정리를 그대로 재현한다.
 * 실패를 재현할 때만 `tokenStore.clear.mockRejectedValue`처럼 메서드를 덮어쓴다.
 */
export function createMemoryTokenStore(initial?: AuthTokenPair): jest.Mocked<TokenStore> {
  let tokens: AuthTokenPair | null = initial ?? null;

  return {
    getAccessToken: jest.fn(async () => tokens?.accessToken ?? null),
    getRefreshToken: jest.fn(async () => tokens?.refreshToken ?? null),
    save: jest.fn(async (next: AuthTokenPair) => {
      tokens = next;
    }),
    clear: jest.fn(async () => {
      tokens = null;
    }),
  };
}

import { createAuthSessionStore } from '@src/features/identity/auth/apis/auth-session.store';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createHttpClientStub, createJsonFetcherStub, renderUiHook } from '@src/shared/__tests__';
import { waitFor } from '@testing-library/react-native';

import { useActivationProgress } from './use-activation-progress';

describe('활성화 진행 상태의 기존 사용자 호환성', () => {
  it('캠페인 설정 요청이 실패해도 사용자 조회가 끝나면 기존 동작을 계속할 수 있다', async () => {
    // Given
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue({
      ok: true,
      value: createCurrentUserDto({ createdAt: '2026-07-31T23:59:59.999Z' }),
    });
    const jsonFetcher = createJsonFetcherStub();
    jsonFetcher.get.mockRejectedValue(new Error('campaign config unavailable'));

    // When
    const { result } = await renderUiHook(() => useActivationProgress(), {
      di: {
        httpClient,
        jsonFetcher,
        authSessionStore: createAuthSessionStore({ status: 'authenticated' }),
      },
    });

    // Then
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.config).toBeUndefined();
    expect(result.current.user?.id).toBe(createCurrentUserDto().userId);
  });
});

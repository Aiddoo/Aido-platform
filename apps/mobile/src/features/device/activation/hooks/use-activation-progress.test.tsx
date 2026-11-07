import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { FeatureCampaignService } from '@src/features/app-config/feature-campaign/apis/feature-campaign.service';
import { createAuthSessionStore } from '@src/features/identity/auth/apis/auth-session.store';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { createHttpClientStub, createTestDi } from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { useActivationProgress } from './use-activation-progress';

describe('활성화 진행 상태의 기존 사용자 호환성', () => {
  let client: QueryClient;

  beforeEach(() => {
    client = createTestQueryClient();
  });

  function createWrapper() {
    const httpClient = createHttpClientStub();
    httpClient.get.mockResolvedValue({
      ok: true,
      value: createCurrentUserDto({
        createdAt: '2026-07-31T23:59:59.999Z',
      }),
    });
    const container = createTestDi({
      httpClient,
      authSessionStore: createAuthSessionStore({ status: 'authenticated' }),
      featureCampaignService: new FeatureCampaignService({
        get: () => Promise.reject(new Error('campaign config unavailable')),
      }),
    });
    return ({ children }: PropsWithChildren) => (
      <StaticDIProvider container={container}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </StaticDIProvider>
    );
  }

  it('캠페인 설정 요청이 실패해도 사용자 조회가 끝나면 기존 동작을 계속할 수 있다', async () => {
    // When
    const { result } = await renderHook(() => useActivationProgress(), {
      wrapper: createWrapper(),
    });

    // Then
    await waitFor(() => expect(result.current.isReady).toBe(true));
    expect(result.current.config).toBeUndefined();
    expect(result.current.user?.id).toBe(createCurrentUserDto().userId);
  });
});

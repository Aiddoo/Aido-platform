import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { toInstant } from '@src/shared/date/instant';
import { NetworkError } from '@src/shared/errors';
import {
  createJsonFetcherStub,
  createMemoryObservableSyncStorage,
  createPendingResponse,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { onlineManager } from '@tanstack/react-query';
import { act, waitFor } from '@testing-library/react-native';

import { createWhatsNewRepository } from '../repositories/whats-new.repository';
import { useWhatsNewAutoOpen } from './use-whats-new-auto-open';

const USER_ID = 'user-1';
const CAMPAIGN_ID = 'feature-discovery-2026-12';
const AUTO_OPEN_CONFIG = {
  enabled: true,
  campaignId: CAMPAIGN_ID,
  minAppVersion: '1.15.0',
  launchedAt: '2026-11-10T00:00:00.000Z',
  autoOpen: true,
};

async function renderAutoOpen({
  jsonFetcher,
  syncStorage = createMemoryObservableSyncStorage(),
}: {
  jsonFetcher: ReturnType<typeof createJsonFetcherStub>;
  syncStorage?: ReturnType<typeof createMemoryObservableSyncStorage>;
}) {
  const queryClient = createTestQueryClient();
  queryClient.setQueryData(
    USER_QUERY_KEYS.me(),
    createUser({ id: USER_ID, createdAt: toInstant('2026-11-06T00:00:00.000Z') }),
  );

  const hook = await renderScreenHook(() => useWhatsNewAutoOpen({ isOnboardingSettled: true }), {
    di: createTestDi({
      ports: { jsonFetcher, syncStorage, queryClient },
      seeds: { authSessionStore: createAuthSessionStoreStub('authenticated') },
    }),
  });

  return { ...hook, repository: createWhatsNewRepository(syncStorage) };
}

describe('useWhatsNewAutoOpen — 말풍선을 띄울 차례', () => {
  it('캠페인 설정을 받는 동안에는 새로운 기능이 먼저 뜰 수 있어 말풍선을 기다린다', async () => {
    // Given
    const jsonFetcher = createJsonFetcherStub();
    const pending = createPendingResponse(AUTO_OPEN_CONFIG);
    jsonFetcher.get.mockReturnValue(pending.response);

    // When
    const { result } = await renderAutoOpen({ jsonFetcher });

    // Then
    expect(result.current.shouldShowCoachmarks).toBe(false);
    await act(async () => pending.settle());
  });

  it('받은 설정으로 자동으로 열 차례면 기다리고, 열어 본 기록이 남으면(닫고 돌아오면) 띄운다', async () => {
    // Given
    const jsonFetcher = createJsonFetcherStub();
    jsonFetcher.get.mockResolvedValue(AUTO_OPEN_CONFIG);
    const { result, repository } = await renderAutoOpen({ jsonFetcher });
    await waitFor(() => expect(result.current.shouldAutoOpen).toBe(true));
    expect(result.current.shouldShowCoachmarks).toBe(false);

    // When
    await act(async () => {
      repository.claimSeen(
        { userId: USER_ID, campaignId: CAMPAIGN_ID },
        toInstant('2026-11-11T09:00:00.000Z'),
      );
    });

    // Then
    expect(result.current.shouldAutoOpen).toBe(false);
    expect(result.current.shouldShowCoachmarks).toBe(true);
  });

  it('이미 본 계정은 설정을 받자마자 기다리지 않고 띄운다', async () => {
    // Given
    const jsonFetcher = createJsonFetcherStub();
    jsonFetcher.get.mockResolvedValue(AUTO_OPEN_CONFIG);
    const syncStorage = createMemoryObservableSyncStorage();
    syncStorage.set(
      `aido_feature_discovery_seen_v1:${USER_ID}:${CAMPAIGN_ID}`,
      '2026-11-10T09:00:00.000Z',
    );

    // When
    const { result } = await renderAutoOpen({ jsonFetcher, syncStorage });

    // Then
    await waitFor(() => expect(jsonFetcher.get).toHaveBeenCalled());
    await waitFor(() => expect(result.current.shouldShowCoachmarks).toBe(true));
    expect(result.current.shouldAutoOpen).toBe(false);
  });

  it('설정을 받지 못하면 새로운 기능을 열지 않는 것으로 보고 말풍선을 띄운다', async () => {
    // Given
    const jsonFetcher = createJsonFetcherStub();
    jsonFetcher.get.mockRejectedValue(new NetworkError());

    // When
    const { result } = await renderAutoOpen({ jsonFetcher });

    // Then
    await waitFor(() => expect(result.current.shouldShowCoachmarks).toBe(true));
    expect(result.current.shouldAutoOpen).toBe(false);
  });

  describe('연결이 없을 때', () => {
    afterEach(() => {
      onlineManager.setOnline(true);
    });

    it('멈춘 조회를 받는 중으로 보지 않아 말풍선을 붙잡아 두지 않는다', async () => {
      // Given
      const jsonFetcher = createJsonFetcherStub();
      jsonFetcher.get.mockResolvedValue(AUTO_OPEN_CONFIG);
      onlineManager.setOnline(false);

      // When
      const { result } = await renderAutoOpen({ jsonFetcher });

      // Then
      expect(result.current.shouldShowCoachmarks).toBe(true);
      expect(jsonFetcher.get).not.toHaveBeenCalled();
    });
  });
});

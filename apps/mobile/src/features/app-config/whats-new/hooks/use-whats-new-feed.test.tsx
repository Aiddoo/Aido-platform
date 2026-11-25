import '@src/shared/i18n/init';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/queries/user-query-keys';
import { toInstant } from '@src/shared/date/instant';
import {
  createMemoryObservableSyncStorage,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { act, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { RELEASE_1_17_0 } from '../constants/releases.constants';
import { RELEASE_ID } from '../constants/whats-new.constants';
import type { WhatsNewCampaignConfig } from '../domains/whats-new-campaign.model';
import { WHATS_NEW_QUERY_KEYS } from '../queries/whats-new-query-keys';
import { useWhatsNewFeed } from './use-whats-new-feed';

const USER_ID = 'user-1';

async function renderFeed({
  signedUpAt,
  isOnboardingSettled = true,
  syncStorage = createMemoryObservableSyncStorage(),
  minAppVersion = '1.15.0',
}: {
  signedUpAt: string;
  isOnboardingSettled?: boolean;
  syncStorage?: ReturnType<typeof createMemoryObservableSyncStorage>;
  minAppVersion?: string;
}) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(
    USER_QUERY_KEYS.me(),
    createUser({ id: USER_ID, createdAt: toInstant(signedUpAt) }),
  );
  const config: WhatsNewCampaignConfig = {
    enabled: true,
    campaignId: RELEASE_1_17_0.campaignId,
    minAppVersion,
    autoOpen: true,
  };
  queryClient.setQueryData(WHATS_NEW_QUERY_KEYS.campaign(), config);
  const onboarding = { isSettled: isOnboardingSettled };
  const hook = await renderScreenHook(
    () => useWhatsNewFeed({ isStable: true, isOnboardingSettled: onboarding.isSettled }),
    {
      di: createTestDi({
        ports: { syncStorage, queryClient },
        seeds: { authSessionStore: createAuthSessionStoreStub('authenticated') },
      }),
      withLocalDate: true,
    },
  );
  const settleOnboarding = async () => {
    onboarding.isSettled = true;
    await hook.rerender(undefined);
  };
  return { ...hook, settleOnboarding };
}

describe('useWhatsNewFeed — 첫 피드', () => {
  beforeEach(() => {
    Object.defineProperty(globalThis, 'requestIdleCallback', {
      configurable: true,
      value: (callback: IdleRequestCallback) => {
        callback({ didTimeout: false, timeRemaining: () => 10 });
        return 1;
      },
    });
    Object.defineProperty(globalThis, 'cancelIdleCallback', {
      configurable: true,
      value: () => undefined,
    });
  });

  it('출시 전에 가입한 사용자는 다른 안내를 기다리지 않고 바로 한 번만 연다', async () => {
    // Given
    const { rerender } = await renderFeed({ signedUpAt: '2026-10-01T00:00:00.000Z' });
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));

    // When
    await rerender(undefined);

    // Then
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/whats-new',
      params: { releaseId: RELEASE_ID.v1_17_0, source: 'auto' },
    });
  });

  it('출시 뒤에 가입한 새 사용자에게도 한 번 연다', async () => {
    // When
    await renderFeed({ signedUpAt: '2026-11-06T00:00:00.000Z' });

    // Then
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });

  it('알림 화면을 열지 말지 정해지기 전에는 기다렸다가 정해진 뒤에 한 번만 연다', async () => {
    // Given
    const { settleOnboarding } = await renderFeed({
      signedUpAt: '2026-10-01T00:00:00.000Z',
      isOnboardingSettled: false,
    });
    await act(async () => undefined);
    expect(router.push).not.toHaveBeenCalled();

    // When
    await settleOnboarding();

    // Then
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });

  it('소개를 묶은 첫 버전보다 낮은 앱에서는 열지 않고 본 기록도 남기지 않는다', async () => {
    // Given
    const syncStorage = createMemoryObservableSyncStorage();

    // When
    await renderFeed({
      signedUpAt: '2026-10-01T00:00:00.000Z',
      syncStorage,
      minAppVersion: '99.0.0',
    });

    // Then
    await act(async () => undefined);
    expect(router.push).not.toHaveBeenCalled();
    expect(
      syncStorage.get(`aido_feature_discovery_seen_v1:${USER_ID}:${RELEASE_1_17_0.campaignId}`),
    ).toBeUndefined();
  });

  it('이 캠페인을 이미 본 계정은 저장 키를 읽어 다시 열지 않는다', async () => {
    // Given
    const syncStorage = createMemoryObservableSyncStorage();
    syncStorage.set(
      `aido_feature_discovery_seen_v1:${USER_ID}:${RELEASE_1_17_0.campaignId}`,
      '2026-11-10T09:00:00.000Z',
    );

    // When
    await renderFeed({ signedUpAt: '2026-10-01T00:00:00.000Z', syncStorage });

    // Then
    await act(async () => undefined);
    expect(router.push).not.toHaveBeenCalled();
  });
});

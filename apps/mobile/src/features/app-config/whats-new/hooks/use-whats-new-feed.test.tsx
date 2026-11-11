import '@src/shared/i18n/init';
import { FEATURE_CAMPAIGN_QUERY_KEYS } from '@src/features/app-config/feature-campaign/constants/feature-campaign-query-keys';
import type { FeatureCampaignConfig } from '@src/features/app-config/feature-campaign/domains/feature-campaign.model';
import { createAuthSessionStoreStub } from '@src/features/identity/auth/__tests__/create-auth-session-store-stub';
import { createUser } from '@src/features/identity/user/__tests__/user.fixtures';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import {
  createMemoryObservableSyncStorage,
  createTestQueryClient,
  renderUiHook,
} from '@src/shared/__tests__';
import { toInstant } from '@src/shared/date/instant';
import { waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';

import { RELEASE_1_15_0 } from '../constants/releases';
import { RELEASE_ID } from '../constants/whats-new.constants';
import { useWhatsNewFeed } from './use-whats-new-feed';

const USER_ID = 'user-1';

async function renderFeed({
  signedUpAt,
  isOnboardingSettled = true,
  syncStorage = createMemoryObservableSyncStorage(),
}: {
  signedUpAt: string;
  isOnboardingSettled?: boolean;
  syncStorage?: ReturnType<typeof createMemoryObservableSyncStorage>;
}) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(
    USER_QUERY_KEYS.me(),
    createUser({ id: USER_ID, createdAt: toInstant(signedUpAt) }),
  );
  const config: FeatureCampaignConfig = {
    enabled: true,
    campaignId: RELEASE_1_15_0.campaignId,
    minAppVersion: '1.15.0',
    autoOpen: true,
  };
  queryClient.setQueryData(FEATURE_CAMPAIGN_QUERY_KEYS.config(), config);
  const onboarding = { isSettled: isOnboardingSettled };
  const hook = await renderUiHook(
    () => useWhatsNewFeed({ isStable: true, isOnboardingSettled: onboarding.isSettled }),
    {
      queryClient,
      withLocalDate: true,
      di: {
        authSessionStore: createAuthSessionStoreStub('authenticated'),
        syncStorage,
      },
    },
  );
  const settleOnboarding = () => {
    onboarding.isSettled = true;
    hook.rerender({});
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
    rerender({});

    // Then
    expect(router.push).toHaveBeenCalledTimes(1);
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/whats-new',
      params: { releaseId: RELEASE_ID.v1_15_0, source: 'auto' },
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
    await new Promise((resolve) => setImmediate(resolve));
    expect(router.push).not.toHaveBeenCalled();

    // When
    settleOnboarding();

    // Then
    await waitFor(() => expect(router.push).toHaveBeenCalledTimes(1));
  });

  it('1.15.0 앱에서 이미 본 계정은 같은 저장 키를 읽어 업데이트한 뒤에도 다시 열지 않는다', async () => {
    // Given
    const syncStorage = createMemoryObservableSyncStorage();
    syncStorage.set(
      `aido_feature_discovery_seen_v1:${USER_ID}:feature-discovery-2026-12`,
      '2026-11-10T09:00:00.000Z',
    );

    // When
    await renderFeed({ signedUpAt: '2026-10-01T00:00:00.000Z', syncStorage });

    // Then
    await new Promise((resolve) => setImmediate(resolve));
    expect(router.push).not.toHaveBeenCalled();
  });
});

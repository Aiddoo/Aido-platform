import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createAnalyticsStub, createHttpClientStub } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { waitFor } from '@testing-library/react-native';

import { useFriendLimitInvite } from './use-friend-limit-invite';

async function renderFriendLimitInvite(isEnabled: boolean) {
  const publicHttpClient = createHttpClientStub();
  publicHttpClient.get.mockResolvedValue(ok({ enabled: isEnabled }));
  const analytics = createAnalyticsStub();
  let openFriendLimitInvite: (() => void) | undefined;
  let renderCount = 0;
  function Capture() {
    openFriendLimitInvite = useFriendLimitInvite();
    renderCount += 1;
    return null;
  }
  await renderScreen(<Capture />, {
    di: {
      analytics,
      httpClient: publicHttpClient,
    },
  });

  return {
    analytics,
    getFriendLimitInvite: () => openFriendLimitInvite,
    getRenderCount: () => renderCount,
  };
}

describe('친구 한도 안내의 초대 길', () => {
  it('초대를 쓸 수 있으면 길을 열고 누르면 진입점을 남긴다', async () => {
    // Given
    const { analytics, getFriendLimitInvite } = await renderFriendLimitInvite(true);
    await waitFor(() => expect(getFriendLimitInvite()).toBeDefined());

    // When
    getFriendLimitInvite()?.();

    // Then
    expect(analytics.trackEvent).toHaveBeenCalledWith('invite_entry_tapped', {
      entry: 'friend_limit_dialog',
    });
  });

  it('초대가 꺼져 있으면 안내를 만들지 않아 구독 안내만 남긴다', async () => {
    // Given
    const { getFriendLimitInvite, getRenderCount } = await renderFriendLimitInvite(false);

    // When
    await waitFor(() => expect(getRenderCount()).toBeGreaterThan(1));

    // Then
    expect(getFriendLimitInvite()).toBeUndefined();
  });
});

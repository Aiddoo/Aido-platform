import '@src/shared/i18n/init';
import type { FriendLimitInvite } from '@src/features/social/friend/domains/friend.model';
import { createAnalyticsStub, createHttpClientStub } from '@src/shared/__tests__';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { ok } from '@src/shared/errors/result';
import { waitFor } from '@testing-library/react-native';

import { createStubInviteService } from '../__tests__/create-stub-invite-service';
import { useFriendLimitInvite } from './use-friend-limit-invite';

async function renderFriendLimitInvite(isEnabled: boolean) {
  const publicHttpClient = createHttpClientStub();
  publicHttpClient.get.mockResolvedValue(ok({ enabled: isEnabled }));
  const analytics = createAnalyticsStub();
  let friendLimitInvite: FriendLimitInvite | undefined;
  let renderCount = 0;
  function Capture() {
    friendLimitInvite = useFriendLimitInvite();
    renderCount += 1;
    return null;
  }
  await renderUi(<Capture />, {
    di: {
      analytics,
      inviteService: createStubInviteService({ publicHttpClient }),
    },
  });

  return {
    analytics,
    getFriendLimitInvite: () => friendLimitInvite,
    getRenderCount: () => renderCount,
  };
}

describe('친구 한도 안내의 초대 길', () => {
  it('초대를 쓸 수 있으면 한도 인원이 담긴 안내를 만들고 누르면 진입점을 남긴다', async () => {
    // Given
    const { analytics, getFriendLimitInvite } = await renderFriendLimitInvite(true);
    await waitFor(() => expect(getFriendLimitInvite()).toBeDefined());

    // When
    const description = getFriendLimitInvite()?.getDescription(7);
    getFriendLimitInvite()?.open();

    // Then
    expect(description).toContain('7');
    expect(analytics.trackEvent).toHaveBeenCalledWith('invite_entry_tapped', {
      entry: 'friend_limit_dialog',
    });
  });

  it('초대가 꺼져 있으면 안내를 만들지 않아 구독 안내만 남긴다', async () => {
    // Given
    const { getFriendLimitInvite, getRenderCount } = await renderFriendLimitInvite(false);
    await waitFor(() => expect(getRenderCount()).toBeGreaterThan(1));

    // Then
    expect(getFriendLimitInvite()).toBeUndefined();
  });
});

import { createPushNotificationGatewayStub, createTestDi } from '@src/testing/core';
import { renderAppRoute } from '@src/testing/render-route-hook';
import { router, Stack } from 'expo-router';
import { act } from 'expo-router/testing-library';
import { Text } from 'react-native';

import { useForegroundPushPresentation } from './use-foreground-push-presentation';

// 실제 라우터로 초대 수락 뒤 남는 상위 route params를 재현하므로 jest.setup의 전역 mock을 끈다
jest.unmock('expo-router');

/** 초대한 친구. 초대를 받아들이면 환영 화면 경로(`/invite-welcome/[friendId]`)에 이 id가 실린다 */
const INVITER_ID = 'clz7x5p8k0002qz0z8z8z8z8z';

/** 할 일 없이 보낸 콕은 보낸 친구의 피드로 연다. 받을 때 다시 받는 종류라 그 피드를 보고 있으면 조용히 남긴다 */
const INVITER_NUDGE_PUSH = {
  data: {
    notificationId: 9,
    type: 'NUDGE_RECEIVED',
    action: { type: 'DEEP_LINK' },
    navigation: { kind: 'FRIEND_FEED', friendId: INVITER_ID },
  },
};

function ForegroundPushPresentation() {
  useForegroundPushPresentation();

  return null;
}

async function setup() {
  const gateway = createPushNotificationGatewayStub();
  await renderAppRoute(
    {
      _layout: () => (
        <>
          <Stack screenOptions={{ headerShown: false, animation: 'none' }} />
          <ForegroundPushPresentation />
        </>
      ),
      'invite/index': () => <Text>Invite</Text>,
      '(app)/_layout': {
        default: () => <Stack screenOptions={{ animation: 'none' }} />,
        unstable_settings: { anchor: '(tabs)' },
      },
      '(app)/(tabs)/_layout': () => <Stack screenOptions={{ animation: 'none' }} />,
      '(app)/(tabs)/(todos)/feed/index': () => <Text>Feed</Text>,
      '(app)/invite-welcome/[friendId]': () => <Text>Welcome</Text>,
    },
    { url: '/feed', di: createTestDi({ ports: { pushNotification: gateway } }) },
  );
  return { gateway };
}

describe('useForegroundPushPresentation', () => {
  it('초대를 받아들인 뒤 내 피드에서 받은 초대한 친구의 콕은 친구 피드를 보는 것이 아니라 배너로 알린다', async () => {
    // Given
    const { gateway } = await setup();
    await act(() => router.push('/invite'));
    await act(() =>
      router.dismissTo(
        { pathname: '/invite-welcome/[friendId]', params: { friendId: INVITER_ID } },
        { withAnchor: true },
      ),
    );
    await act(() => router.back());

    // When
    const presentation = gateway.presentInForeground(INVITER_NUDGE_PUSH);

    // Then
    expect(presentation).toBe('banner');

    // When
    await act(() => router.setParams({ friendId: INVITER_ID }));

    // Then
    expect(gateway.presentInForeground(INVITER_NUDGE_PUSH)).toBe('quiet');
  });
});

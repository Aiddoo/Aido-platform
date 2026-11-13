import { createPushNotificationGatewayStub, createTestDi } from '@src/testing/core';
import { renderScreenHook } from '@src/testing/render';
import { useLocalSearchParams, usePathname } from 'expo-router';

import { useForegroundPushPresentation } from './use-foreground-push-presentation';

const NUDGE_PUSH = {
  data: {
    notificationId: 7,
    type: 'NUDGE_RECEIVED',
    action: { type: 'DEEP_LINK' },
    navigation: { kind: 'NUDGE', nudgeId: 5 },
  },
};

async function setup({ pathname, params }: { pathname: string; params: Record<string, string> }) {
  jest.mocked(usePathname).mockReturnValue(pathname);
  jest.mocked(useLocalSearchParams).mockReturnValue(params);
  const gateway = createPushNotificationGatewayStub();
  await renderScreenHook(() => useForegroundPushPresentation(), {
    di: createTestDi({ ports: { pushNotification: gateway } }),
  });
  return { gateway };
}

describe('useForegroundPushPresentation', () => {
  it('그 콕 화면을 보고 있으면 받은 콕 알림을 배너 없이 알림 센터에만 남긴다', async () => {
    // Given
    const { gateway } = await setup({ pathname: '/nudges/5', params: { nudgeId: '5' } });

    // When
    const presentation = gateway.presentInForeground(NUDGE_PUSH);

    // Then
    expect(presentation).toBe('quiet');
  });

  it('다른 화면을 보고 있으면 배너로 알린다', async () => {
    // Given
    const { gateway } = await setup({ pathname: '/feed', params: {} });

    // When
    const presentation = gateway.presentInForeground(NUDGE_PUSH);

    // Then
    expect(presentation).toBe('banner');
  });

  it('계약에 맞지 않는 알림은 배너로 알린다', async () => {
    // Given
    const { gateway } = await setup({ pathname: '/notifications', params: {} });

    // When
    const presentation = gateway.presentInForeground({ data: { notificationId: 'broken' } });

    // Then
    expect(presentation).toBe('banner');
  });
});

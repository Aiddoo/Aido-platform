import '@src/shared/i18n/init';
import type { PushPermissionResponse } from '@src/core/ports/push-notification-gateway';
import {
  createAnalyticsStub,
  createExternalLinkGatewayStub,
  createPushNotificationGatewayStub,
  createTestQueryClient,
  createTestDi,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { Suspense } from 'react';

import { PushPermissionSettings } from './push-permission-settings';

async function renderSettings(permission: PushPermissionResponse) {
  const pushNotification = createPushNotificationGatewayStub();
  pushNotification.getPermission.mockResolvedValue(permission);
  const externalLink = createExternalLinkGatewayStub();
  const analytics = createAnalyticsStub();

  await renderScreen(
    <Suspense fallback={null}>
      <PushPermissionSettings />
    </Suspense>,
    {
      di: createTestDi({
        ports: { pushNotification, externalLink, analytics, queryClient: createTestQueryClient() },
      }),
    },
  );
  const row = await screen.findByRole('button');

  return { row, pushNotification, externalLink, analytics };
}

// 권한을 묻는 단계와 추적은 usePushPermissionAction 테스트가 본다. 여기는 이 줄만의 허용 뒤 동작이다
describe('PushPermissionSettings', () => {
  it('이미 허용한 기기 알림 줄을 누르면 권한을 다시 묻지 않고 기기 설정만 연다', async () => {
    // Given
    const user = userEvent.setup();
    const { row, pushNotification, externalLink, analytics } = await renderSettings({
      status: 'granted',
      canAskAgain: true,
      iosStatus: null,
    });

    // When
    await user.press(row);

    // Then
    await waitFor(() => expect(externalLink.openSettings).toHaveBeenCalledTimes(1));
    expect(pushNotification.requestPermission).not.toHaveBeenCalled();
    expect(analytics.trackEvent).not.toHaveBeenCalledWith(
      'push_permission_settings_opened',
      expect.anything(),
    );
  });
});

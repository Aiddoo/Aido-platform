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

  it('거절해 다시 물을 수 없는 기기는 시스템 창 대신 기기 설정을 열고 설정에서 열었다고 남긴다', async () => {
    // Given
    const user = userEvent.setup();
    const { row, pushNotification, externalLink, analytics } = await renderSettings({
      status: 'denied',
      canAskAgain: false,
      iosStatus: null,
    });

    // When
    await user.press(row);

    // Then
    await waitFor(() => expect(externalLink.openSettings).toHaveBeenCalledTimes(1));
    expect(pushNotification.requestPermission).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith('push_permission_settings_opened', {
        source: 'settings',
      }),
    );
  });

  it('아직 묻지 않은 기기는 [계속]으로 시스템 창을 한 번 띄운다', async () => {
    // Given
    const user = userEvent.setup();
    const { row, pushNotification, externalLink, analytics } = await renderSettings({
      status: 'undetermined',
      canAskAgain: true,
      iosStatus: null,
    });

    // When
    await user.press(row);

    // Then
    await waitFor(() => expect(pushNotification.requestPermission).toHaveBeenCalledTimes(1));
    expect(externalLink.openSettings).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(analytics.trackEvent).toHaveBeenCalledWith('push_permission_requested', {
        source: 'settings',
        status: 'GRANTED',
      }),
    );
  });
});

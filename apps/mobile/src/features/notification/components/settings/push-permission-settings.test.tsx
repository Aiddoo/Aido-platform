import '@src/shared/i18n/init';
import type { PushPermissionResponse } from '@src/core/ports/push-notification-gateway';
import {
  createAnalyticsStub,
  createExternalLinkGatewayStub,
  createPushNotificationGatewayStub,
  createTestQueryClient,
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
    { di: { pushNotification, externalLink, analytics }, queryClient: createTestQueryClient() },
  );
  const row = await screen.findByRole('button');

  return { row, pushNotification, externalLink, analytics };
}

describe('PushPermissionSettings — 기기 알림 줄을 누르면', () => {
  it('아직 묻지 않았으면 시스템 권한 창을 띄운다', async () => {
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
    expect(analytics.trackEvent).toHaveBeenCalledWith('push_permission_requested', {
      source: 'settings',
      status: 'GRANTED',
    });
  });

  it('거절하고 다시 물을 수 없으면 기기 설정을 연다', async () => {
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
    expect(analytics.trackEvent).toHaveBeenCalledWith('push_permission_settings_opened', {
      source: 'settings',
    });
  });

  it('이미 허용했으면 권한을 다시 묻지 않고 기기 설정만 연다', async () => {
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

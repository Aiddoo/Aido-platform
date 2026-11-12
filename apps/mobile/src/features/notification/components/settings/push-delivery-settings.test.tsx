import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { toPreference } from '@src/features/identity/preference/apis/preference.mapper';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import {
  createAnalyticsStub,
  createHttpClientStub,
  createPushNotificationGatewayStub,
  createTestDi,
  createTestQueryClient,
} from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { Suspense } from 'react';

import {
  createPushDeviceResponseDto,
  createPushPermission,
} from '../../__tests__/notification.fixtures';
import { PUSH_PERMISSION_QUERY_KEYS } from '../../queries/push-permission-query-keys';
import { PushDeliverySettings } from './push-delivery-settings';

async function renderSettings({ pushEnabled }: { pushEnabled: boolean }) {
  const analytics = createAnalyticsStub();
  const pushNotification = createPushNotificationGatewayStub();
  const httpClient = createHttpClientStub();
  httpClient.patch.mockResolvedValue(ok(createPreferenceDto({ pushEnabled: !pushEnabled })));
  httpClient.put.mockResolvedValue(ok(createPushDeviceResponseDto()));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(
    PREFERENCE_QUERY_KEYS.current(),
    toPreference(createPreferenceDto({ pushEnabled })),
  );
  queryClient.setQueryData(PUSH_PERMISSION_QUERY_KEYS.current(), createPushPermission());

  await renderScreen(
    <Suspense fallback={null}>
      <PushDeliverySettings />
    </Suspense>,
    { di: createTestDi({ ports: { analytics, httpClient, pushNotification, queryClient } }) },
  );
  const pushToggle = await screen.findByText('푸시 알림');
  const getPushPermissionEvents = () =>
    analytics.trackEvent.mock.calls.filter(([name]) => name.startsWith('push_permission_'));

  return { pushToggle, pushNotification, getPushPermissionEvents };
}

describe('PushDeliverySettings', () => {
  it('앱 푸시를 켜면 저장한 뒤 권한을 묻고 설정에서 물었다고 한 번 남긴다', async () => {
    // Given
    const { pushToggle, pushNotification, getPushPermissionEvents } = await renderSettings({
      pushEnabled: false,
    });

    // When
    await userEvent.press(pushToggle);

    // Then
    await waitFor(() => expect(getPushPermissionEvents()).toHaveLength(1));
    expect(pushNotification.requestPermission).toHaveBeenCalledTimes(1);
    expect(getPushPermissionEvents()).toEqual([
      ['push_permission_requested', { source: 'settings', status: 'GRANTED' }],
    ]);
  });

  it('앱 푸시를 끄면 권한을 묻지 않는다', async () => {
    // Given
    const { pushToggle, pushNotification, getPushPermissionEvents } = await renderSettings({
      pushEnabled: true,
    });

    // When
    await userEvent.press(pushToggle);

    // Then
    expect(await screen.findByText('푸시 알림을 먼저 활성화해주세요')).toBeTruthy();
    expect(pushNotification.requestPermission).not.toHaveBeenCalled();
    expect(getPushPermissionEvents()).toEqual([]);
  });
});

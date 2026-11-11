import '@src/shared/i18n/init';
import { ok } from '@src/core/errors/result';
import type { PushPermissionResponse } from '@src/core/ports/push-notification-gateway';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { toPreference } from '@src/features/identity/preference/apis/preference.mapper';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import {
  createAnalyticsStub,
  createExternalLinkGatewayStub,
  createHttpClientStub,
  createPushNotificationGatewayStub,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { screen, userEvent, waitFor } from '@testing-library/react-native';
import { Suspense } from 'react';

import { PushPermissionToggle } from './push-permission-toggle';

const LABEL = '체험 끝나기 전 알림';
const DESCRIPTIONS = {
  on: '12월 6일에 푸시로 알려드려요',
  off: '알림을 켜면 12월 6일에 알려드려요',
};

async function renderToggle({
  permission,
  pushEnabled,
}: {
  permission: PushPermissionResponse;
  pushEnabled: boolean;
}) {
  const pushNotification = createPushNotificationGatewayStub();
  pushNotification.getPermission.mockResolvedValue(permission);
  const externalLink = createExternalLinkGatewayStub();
  const analytics = createAnalyticsStub();
  const httpClient = createHttpClientStub();
  httpClient.patch.mockResolvedValue(ok(createPreferenceDto({ pushEnabled: true })));
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(
    PREFERENCE_QUERY_KEYS.current(),
    toPreference(createPreferenceDto({ pushEnabled })),
  );

  await renderUi(
    <Suspense fallback={null}>
      <PushPermissionToggle source="paywall" label={LABEL} descriptions={DESCRIPTIONS} />
    </Suspense>,
    { di: { pushNotification, externalLink, analytics, httpClient }, queryClient },
  );
  const toggle = await screen.findByRole('switch');

  return { toggle, pushNotification, externalLink, analytics, httpClient };
}

describe('PushPermissionToggle', () => {
  it.each([
    ['아직 묻지 않았으면', { status: 'undetermined', canAskAgain: true, iosStatus: null }],
    ['거절했지만 다시 물을 수 있으면', { status: 'denied', canAskAgain: true, iosStatus: null }],
  ] as const)('%s 시스템 권한 창을 띄운다', async (_case, permission) => {
    // Given
    const user = userEvent.setup();
    const { toggle, pushNotification, externalLink, analytics } = await renderToggle({
      permission,
      pushEnabled: true,
    });

    // When
    await user.press(toggle);

    // Then
    await waitFor(() => expect(pushNotification.requestPermission).toHaveBeenCalledTimes(1));
    expect(externalLink.openSettings).not.toHaveBeenCalled();
    expect(analytics.trackEvent).toHaveBeenCalledWith('push_permission_requested', {
      source: 'paywall',
      status: 'GRANTED',
    });
  });

  it('거절하고 다시 물을 수 없으면 기기 설정을 연다', async () => {
    // Given
    const user = userEvent.setup();
    const { toggle, pushNotification, externalLink, analytics } = await renderToggle({
      permission: { status: 'denied', canAskAgain: false, iosStatus: null },
      pushEnabled: true,
    });

    // When
    await user.press(toggle);

    // Then
    await waitFor(() => expect(externalLink.openSettings).toHaveBeenCalledTimes(1));
    expect(pushNotification.requestPermission).not.toHaveBeenCalled();
    expect(analytics.trackEvent).toHaveBeenCalledWith('push_permission_settings_opened', {
      source: 'paywall',
    });
  });

  it('기기는 허용했지만 앱 알림이 꺼져 있으면 앱 알림을 켠다', async () => {
    // Given
    const user = userEvent.setup();
    const { toggle, httpClient, externalLink } = await renderToggle({
      permission: { status: 'granted', canAskAgain: true, iosStatus: null },
      pushEnabled: false,
    });
    expect(screen.getByText(DESCRIPTIONS.off)).toBeTruthy();

    // When
    await user.press(toggle);

    // Then
    await waitFor(() =>
      expect(httpClient.patch).toHaveBeenCalledWith('v1/auth/preference', { pushEnabled: true }),
    );
    expect(externalLink.openSettings).not.toHaveBeenCalled();
  });

  it('이미 받을 수 있으면 켜진 채 잠겨 여기서 끌 수 없다', async () => {
    // When
    const { toggle } = await renderToggle({
      permission: { status: 'granted', canAskAgain: true, iosStatus: null },
      pushEnabled: true,
    });

    // Then
    expect(toggle).toBeChecked();
    expect(toggle).toBeDisabled();
    expect(screen.getByText(DESCRIPTIONS.on)).toBeTruthy();
  });
});

import '@src/shared/i18n/init';
import type { PushPermissionResponse } from '@src/core/ports/push-notification-gateway';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { toPreference } from '@src/features/identity/preference/apis/preference.mapper';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/queries/preference-query-keys';
import {
  createPushNotificationGatewayStub,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { screen } from '@testing-library/react-native';

import { PushStatusValue } from './push-status-value';

async function renderValue({
  permission,
  pushEnabled,
}: {
  permission: PushPermissionResponse;
  pushEnabled: boolean;
}) {
  const pushNotification = createPushNotificationGatewayStub();
  pushNotification.getPermission.mockResolvedValue(permission);
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(
    PREFERENCE_QUERY_KEYS.current(),
    toPreference(createPreferenceDto({ pushEnabled })),
  );

  await renderUi(<PushStatusValue />, { di: { pushNotification }, queryClient });

  return screen.findByTestId('push-status-value');
}

describe('PushStatusValue', () => {
  it.each([
    [
      '기기 허용과 앱 알림이 모두 켜져 있으면 켜짐',
      { status: 'granted', canAskAgain: true, iosStatus: null },
      true,
      '켜짐',
    ],
    [
      '기기는 허용했지만 앱 알림을 껐으면 꺼짐',
      { status: 'granted', canAskAgain: true, iosStatus: null },
      false,
      '꺼짐',
    ],
    [
      '앱 알림은 켰지만 기기에서 거절했으면 기기에서 꺼짐',
      { status: 'denied', canAskAgain: false, iosStatus: null },
      true,
      '기기에서 꺼짐',
    ],
    [
      '앱 알림은 켰지만 기기 알림을 아직 묻지 않았으면 꺼짐',
      { status: 'undetermined', canAskAgain: true, iosStatus: null },
      true,
      '꺼짐',
    ],
    [
      'iOS 임시 허용은 조용히 도착하므로 켜짐',
      { status: 'undetermined', canAskAgain: true, iosStatus: 'PROVISIONAL' },
      true,
      '켜짐',
    ],
  ] as const)('%s으로 보인다', async (_case, permission, pushEnabled, expected) => {
    // When
    const value = await renderValue({ permission, pushEnabled });

    // Then
    expect(value).toHaveTextContent(expected);
  });
});

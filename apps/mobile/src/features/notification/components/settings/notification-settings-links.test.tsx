import '@src/shared/i18n/init';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { toPreference } from '@src/features/identity/preference/apis/preference.mapper';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/constants/preference-query-keys';
import {
  createHttpClientStub,
  createPushNotificationGatewayStub,
  createTestQueryClient,
  renderUi,
} from '@src/shared/__tests__';
import { screen } from '@testing-library/react-native';

import { NOTIFICATION_QUERY_KEYS } from '../../constants/notification-query-keys';
import type { PushPermission } from '../../domains/push-permission.model';
import { NotificationSettingsLinks } from './notification-settings-links';

async function renderLinks({
  pushEnabled,
  permission,
}: {
  pushEnabled: boolean;
  permission: PushPermission;
}) {
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  queryClient.setQueryData(
    PREFERENCE_QUERY_KEYS.current(),
    toPreference(createPreferenceDto({ pushEnabled })),
  );
  queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.permission(), permission);

  await renderUi(<NotificationSettingsLinks />, {
    di: {
      httpClient: createHttpClientStub(),
      pushNotification: createPushNotificationGatewayStub(),
    },
    queryClient,
    withLocalDate: true,
  });
}

describe('NotificationSettingsLinks — 푸시 알림 요약', () => {
  it('앱 설정은 켜져 있어도 기기 알림이 꺼져 있으면 켜짐 대신 기기에서 꺼짐으로 보인다', async () => {
    // Given
    const permission: PushPermission = { status: 'DENIED', canAskAgain: false };

    // When
    await renderLinks({ pushEnabled: true, permission });

    // Then
    expect(screen.getByText('기기에서 꺼짐')).toBeOnTheScreen();
    expect(screen.queryByText('켜짐')).not.toBeOnTheScreen();
  });

  it('기기 알림을 허용했으면 서버 설정대로 켜짐으로 보인다', async () => {
    // Given
    const permission: PushPermission = { status: 'GRANTED', canAskAgain: true };

    // When
    await renderLinks({ pushEnabled: true, permission });

    // Then
    expect(screen.queryByText('기기에서 꺼짐')).not.toBeOnTheScreen();
    expect(screen.getAllByText('켜짐').length).toBeGreaterThan(0);
  });

  it('앱 설정에서 끈 푸시는 기기 권한과 상관없이 꺼짐으로 보인다', async () => {
    // Given
    const permission: PushPermission = { status: 'DENIED', canAskAgain: false };

    // When
    await renderLinks({ pushEnabled: false, permission });

    // Then
    expect(screen.queryByText('기기에서 꺼짐')).not.toBeOnTheScreen();
    expect(screen.getAllByText('꺼짐').length).toBeGreaterThan(0);
  });
});

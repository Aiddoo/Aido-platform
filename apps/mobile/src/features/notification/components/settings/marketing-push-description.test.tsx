import '@src/shared/i18n/init';
import type { PushPermissionResponse } from '@src/core/ports/push-notification-gateway';
import { Text } from '@src/shared/ui';
import { createPushNotificationGatewayStub, createTestQueryClient } from '@src/testing/core';
import { renderScreen } from '@src/testing/render';
import { screen } from '@testing-library/react-native';

import { MarketingPushDescription } from './marketing-push-description';

async function renderDescription(permission: PushPermissionResponse) {
  const pushNotification = createPushNotificationGatewayStub();
  pushNotification.getPermission.mockResolvedValue(permission);

  await renderScreen(
    <Text testID="marketing-push-description">
      <MarketingPushDescription />
    </Text>,
    { di: { pushNotification }, queryClient: createTestQueryClient() },
  );

  return screen.findByTestId('marketing-push-description');
}

describe('MarketingPushDescription', () => {
  it.each([
    [
      '기기 알림을 허용했으면 받는 소식',
      { status: 'granted', canAskAgain: true, iosStatus: null },
      '이벤트·혜택·맞춤 추천 알림을 받아요',
    ],
    [
      '기기에서 거절했으면 지금은 받을 수 없다는 안내',
      { status: 'denied', canAskAgain: false, iosStatus: null },
      '기기 알림이 꺼져 있어 지금은 받을 수 없어요',
    ],
    [
      '기기 알림을 아직 묻지 않았어도 지금은 받을 수 없다는 안내',
      { status: 'undetermined', canAskAgain: true, iosStatus: null },
      '기기 알림이 꺼져 있어 지금은 받을 수 없어요',
    ],
  ] as const)('%s를 보인다', async (_case, permission, expected) => {
    // When
    const description = await renderDescription(permission);

    // Then
    expect(description).toHaveTextContent(expected);
  });
});

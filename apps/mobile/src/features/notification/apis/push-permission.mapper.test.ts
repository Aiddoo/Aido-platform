import { createPushPermissionResponse } from '../__tests__/notification.fixtures';
import { toPushPermission } from './push-permission.mapper';

describe('toPushPermission', () => {
  it('iOS 임시 허용은 일반 상태가 미결정이어도 PROVISIONAL로 본다', () => {
    // Given
    const response = createPushPermissionResponse({
      status: 'undetermined',
      canAskAgain: true,
      iosStatus: 'PROVISIONAL',
    });

    // When
    const permission = toPushPermission(response);

    // Then
    expect(permission).toEqual({ status: 'PROVISIONAL', canAskAgain: true });
  });

  it('Android 거절은 다시 물을 수 있는지를 그대로 남긴다', () => {
    // Given
    const response = createPushPermissionResponse({ status: 'denied', canAskAgain: true });

    // When
    const permission = toPushPermission(response);

    // Then
    expect(permission).toEqual({ status: 'DENIED', canAskAgain: true });
  });
});

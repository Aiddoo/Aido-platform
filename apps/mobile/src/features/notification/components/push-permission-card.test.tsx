import { createSessionEpoch } from '@src/core/session/session-epoch';
import '@src/shared/i18n/init';
import { createPreferenceDto } from '@src/features/identity/preference/__tests__/preference.fixtures';
import { toPreference } from '@src/features/identity/preference/apis/preference.mapper';
import { PreferenceService } from '@src/features/identity/preference/apis/preference.service';
import { PREFERENCE_QUERY_KEYS } from '@src/features/identity/preference/constants/preference-query-keys';
import { createCurrentUserDto } from '@src/features/identity/user/__tests__/user.fixtures';
import { toUser } from '@src/features/identity/user/apis/user.mapper';
import { UserService } from '@src/features/identity/user/apis/user.service';
import { USER_QUERY_KEYS } from '@src/features/identity/user/constants/user-query-keys';
import { createAnalyticsStub, createHttpClientStub } from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderUi } from '@src/shared/__tests__/render-ui';
import { deviceSyncStorage } from '@src/shared/infra/storage/device-sync-storage';
import { fireEvent, screen, waitFor } from '@testing-library/react-native';

import {
  createPushDeviceResponseDto,
  createPushNotificationGatewayStub,
  createPushPermissionResponse,
} from '../__tests__/notification.fixtures';
import { PushDeviceService } from '../apis/push-device.service';
import { createPushPromptRepository } from '../apis/push-prompt.repository';
import { NOTIFICATION_QUERY_KEYS } from '../constants/notification-query-keys';
import type { PushPermission } from '../schemas/push-permission.schema';
import { PushPermissionCard } from './push-permission-card';

const silentLogger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

async function renderCard(
  permission: PushPermission,
  { pushEnabled = true }: { pushEnabled?: boolean } = {},
) {
  const httpClient = createHttpClientStub();
  httpClient.put.mockResolvedValue({ ok: true, value: createPushDeviceResponseDto() });
  const gateway = createPushNotificationGatewayStub({
    requestPermission: jest.fn(async () => createPushPermissionResponse({ status: 'granted' })),
  });
  const queryClient = createTestQueryClient({
    defaultOptions: { queries: { staleTime: Infinity } },
  });
  const me = toUser(createCurrentUserDto());
  queryClient.setQueryData(USER_QUERY_KEYS.me(), me);
  queryClient.setQueryData(
    PREFERENCE_QUERY_KEYS.current(),
    toPreference(createPreferenceDto({ pushEnabled })),
  );
  queryClient.setQueryData(NOTIFICATION_QUERY_KEYS.permission(), permission);

  await renderUi(<PushPermissionCard />, {
    di: {
      pushPromptRepository: createPushPromptRepository(deviceSyncStorage),
      pushDeviceService: new PushDeviceService({
        gateway,
        deviceIdService: { get: async () => 'ios_device-123' },
        httpClient,
        logger: silentLogger,
        getTimeZone: () => 'Asia/Seoul',
        sessionEpoch: createSessionEpoch(),
      }),
      preferenceService: new PreferenceService(httpClient),
      userService: new UserService(httpClient),
      analytics: createAnalyticsStub(),
      logger: silentLogger,
    },
    queryClient,
  });
  return { gateway };
}

describe('PushPermissionCard — 홈 알림 안내', () => {
  afterEach(() => {
    deviceSyncStorage.keys().forEach((key) => deviceSyncStorage.remove(key));
  });

  it('알림이 기기에서 허용되고 앱 설정도 켜져 있으면 보이지 않는다', async () => {
    // Given / When
    await renderCard({ status: 'GRANTED', canAskAgain: false });

    // Then
    expect(screen.queryByText('할 일 알림을 받아 보세요')).toBeNull();
    expect(screen.queryByText('알림이 꺼져 있어요')).toBeNull();
  });

  it('아직 묻지 않았으면 계속을 눌렀을 때 앱 안 안내를 먼저 띄운다', async () => {
    // Given
    const { gateway } = await renderCard({ status: 'NOT_DETERMINED', canAskAgain: true });

    // When
    fireEvent.press(screen.getByText('계속'));

    // Then 시스템 창은 안내에서 계속을 눌러야 뜬다
    expect(await screen.findByText('알림을 보내드려도 될까요?')).toBeTruthy();
    expect(gateway.requestPermission).not.toHaveBeenCalled();
  });

  it('거절 후 다시 물을 수 없으면 기기 설정을 열게 한다', async () => {
    // Given
    const { gateway } = await renderCard({ status: 'DENIED', canAskAgain: false });

    // When
    fireEvent.press(screen.getByText('설정 열기'));

    // Then
    expect(screen.getByText('설정에서 켜면 리마인드 알림을 받을 수 있어요')).toBeTruthy();
    await waitFor(() => {
      expect(gateway.openSettings).toHaveBeenCalledTimes(1);
    });
  });

  it('기기는 허용인데 앱 푸시 설정이 꺼져 있으면 알림 설정으로 안내한다', async () => {
    await renderCard({ status: 'PROVISIONAL', canAskAgain: true }, { pushEnabled: false });

    expect(screen.getByText('푸시 알림이 꺼져 있어요')).toBeTruthy();
  });

  it('닫으면 14일 동안 숨긴다', async () => {
    // Given
    await renderCard({ status: 'DENIED', canAskAgain: false });

    // When
    fireEvent.press(screen.getByLabelText('알림 안내 닫기'));

    // Then
    await waitFor(() => {
      expect(screen.queryByText('알림이 꺼져 있어요')).toBeNull();
    });
  });
});

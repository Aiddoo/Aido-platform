import { createAuthSessionStore } from '@src/features/identity/auth/apis/auth-session.store';
import {
  createCurrentUserDto,
  createUserApiError,
} from '@src/features/identity/user/__tests__/user.fixtures';
import {
  createPushDeviceResponseDto,
  createPushPermissionResponse,
} from '@src/features/notification/__tests__/notification.fixtures';
import {
  createHttpClientStub,
  createJsonFetcherStub,
  createMemoryObservableSyncStorage,
  createPushNotificationGatewayStub,
  renderUiHook,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { toInstant } from '@src/shared/date/instant';
import { act, waitFor } from '@testing-library/react-native';

import { createActivationProgressRepository } from '../apis/activation-progress.repository';
import { ACTIVATION_QUERY_KEYS } from '../constants/activation-query-keys';
import { usePushPermissionAskMoment } from './use-push-permission-ask-moment';

const CAMPAIGN_ID = 'feature-discovery-2026-08';
const EXISTING_USER_CREATED_AT = '2026-07-01T00:00:00.000Z';
const NEW_USER_CREATED_AT = '2026-08-01T00:00:00.000Z';

function setup({
  permissionStatus = 'undetermined',
  userCreatedAt = EXISTING_USER_CREATED_AT,
  isUserLoadable = true,
}: {
  permissionStatus?: 'undetermined' | 'granted' | 'denied';
  userCreatedAt?: string;
  isUserLoadable?: boolean;
} = {}) {
  const gateway = createPushNotificationGatewayStub({
    getPermission: jest.fn(async () =>
      createPushPermissionResponse({ status: permissionStatus, canAskAgain: true }),
    ),
  });
  const httpClient = createHttpClientStub();
  const user = createCurrentUserDto({ createdAt: userCreatedAt });
  httpClient.get.mockResolvedValue(
    isUserLoadable ? { ok: true, value: user } : { ok: false, error: createUserApiError() },
  );
  httpClient.put.mockResolvedValue({ ok: true, value: createPushDeviceResponseDto() });
  const jsonFetcher = createJsonFetcherStub();
  jsonFetcher.get.mockResolvedValue({
    enabled: true,
    campaignId: CAMPAIGN_ID,
    minAppVersion: '1.8.0',
    launchedAt: '2026-08-01T00:00:00.000Z',
    autoOpen: true,
  });
  const syncStorage = createMemoryObservableSyncStorage();
  const activationRepository = createActivationProgressRepository(syncStorage);
  const queryClient = createTestQueryClient();
  const render = () =>
    renderUiHook(() => usePushPermissionAskMoment(), {
      queryClient,
      di: {
        httpClient,
        jsonFetcher,
        syncStorage,
        pushNotification: gateway,
        authSessionStore: createAuthSessionStore({ status: 'authenticated' }),
      },
    });
  const activate = async () => {
    const identity = { accountId: user.userId, campaignId: CAMPAIGN_ID };
    activationRepository.markTodoCreated(identity, toInstant('2026-08-01T12:00:00.000Z'));
    activationRepository.claimActivated(identity, toInstant('2026-08-02T00:00:00.000Z'));
    await queryClient.invalidateQueries({ queryKey: ACTIVATION_QUERY_KEYS.progress(identity) });
  };
  return { gateway, render, activate };
}

describe('usePushPermissionAskMoment', () => {
  it('기존 사용자가 아직 알림 권한을 정하지 않았으면 로그인하자마자 안내할 차례가 된다', async () => {
    // Given
    const { gateway, render } = setup();

    // When
    const { result } = await render();

    // Then
    // 시스템 창은 안내에서 허용을 눌렀을 때만 뜬다
    await waitFor(() => {
      expect(result.current[0]).toBe(true);
    });
    expect(gateway.requestPermission).not.toHaveBeenCalled();
  });

  it('안내를 마치면 같은 계정·활성화 시점에는 다시 묻지 않는다', async () => {
    // Given
    const { render } = setup();
    const { result } = await render();
    await waitFor(() => {
      expect(result.current[0]).toBe(true);
    });

    // When
    await act(() => result.current[1]());

    // Then
    expect(result.current[0]).toBe(false);
  });

  it('이미 허용하거나 거절한 사용자에게는 묻지 않는다', async () => {
    // Given
    const { gateway, render } = setup({ permissionStatus: 'denied' });

    // When
    const { result } = await render();

    // Then
    await waitFor(() => {
      expect(gateway.getPermission).toHaveBeenCalled();
    });
    expect(result.current[0]).toBe(false);
  });

  it('활성화 전 신규 사용자에게는 묻지 않고, 활성화하면 그때 안내한다', async () => {
    // Given
    const { gateway, render, activate } = setup({ userCreatedAt: NEW_USER_CREATED_AT });
    const { result } = await render();
    await waitFor(() => {
      expect(gateway.getPermission).toHaveBeenCalled();
    });
    expect(result.current[0]).toBe(false);

    // When
    await act(() => activate());

    // Then
    await waitFor(() => {
      expect(result.current[0]).toBe(true);
    });
  });

  it('/me 조회가 실패해도 기존 권한 요청 흐름을 막지 않는다', async () => {
    // Given
    const { render } = setup({ isUserLoadable: false });

    // When
    const { result } = await render();

    // Then
    await waitFor(() => {
      expect(result.current[0]).toBe(true);
    });
  });
});

import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { Logger } from '@src/core/ports/logger';
import { FeatureCampaignService } from '@src/features/app-config/feature-campaign/apis/feature-campaign.service';
import { createAuthSessionStore } from '@src/features/identity/auth/apis/auth-session.store';
import {
  createCurrentUserDto,
  createUserApiError,
} from '@src/features/identity/user/__tests__/user.fixtures';
import {
  createPushDeviceResponseDto,
  createPushNotificationGatewayStub,
  createPushPermissionResponse,
} from '@src/features/notification/__tests__/notification.fixtures';
import { PushDeviceService } from '@src/features/notification/apis/push-device.service';
import {
  createHttpClientStub,
  createMemorySyncStorage,
  createTestDiContainer,
} from '@src/shared/__tests__';
import { createTestDi } from '@src/shared/__tests__/create-test-di';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { toInstant } from '@src/shared/date/instant';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { createActivationProgressRepository } from '../apis/activation-progress.repository';
import { ActivationService } from '../apis/activation.service';
import { ACTIVATION_QUERY_KEYS } from '../constants/activation-query-keys';
import { usePushPermissionAskMoment } from './use-push-permission-ask-moment';

const CAMPAIGN_ID = 'feature-discovery-2026-08';
const EXISTING_USER_CREATED_AT = '2026-07-01T00:00:00.000Z';
const NEW_USER_CREATED_AT = '2026-08-01T00:00:00.000Z';

const silentLogger: Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

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
  const pushDeviceService = new PushDeviceService(
    gateway,
    { get: async () => 'ios_device-123' },
    httpClient,
    silentLogger,
    () => 'Asia/Seoul',
  );
  const activationRepository = createActivationProgressRepository(createMemorySyncStorage());
  const queryClient = createTestQueryClient();
  const container = createTestDiContainer({
    ...createTestDi({ httpClient }),
    pushDeviceService,
    logger: silentLogger,
    authSessionStore: createAuthSessionStore({ status: 'authenticated' }),
    activationService: new ActivationService(activationRepository),
    featureCampaignService: new FeatureCampaignService({
      get: async () => ({
        enabled: true,
        campaignId: CAMPAIGN_ID,
        minAppVersion: '1.8.0',
        launchedAt: '2026-08-01T00:00:00.000Z',
        autoOpen: true,
      }),
    }),
  });
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StaticDIProvider>
  );
  const activate = async () => {
    const identity = { accountId: user.userId, campaignId: CAMPAIGN_ID };
    activationRepository.markTodoCreated(identity, toInstant('2026-08-01T12:00:00.000Z'));
    activationRepository.claimActivated(identity, toInstant('2026-08-02T00:00:00.000Z'));
    await queryClient.invalidateQueries({ queryKey: ACTIVATION_QUERY_KEYS.progress(identity) });
  };
  return { gateway, wrapper, activate };
}

describe('usePushPermissionAskMoment', () => {
  it('기존 사용자가 아직 알림 권한을 정하지 않았으면 로그인하자마자 안내할 차례가 된다', async () => {
    // Given
    const { gateway, wrapper } = setup();

    // When
    const { result } = await renderHook(() => usePushPermissionAskMoment(), { wrapper });

    // Then 시스템 창은 안내에서 허용을 눌렀을 때만 뜬다
    await waitFor(() => {
      expect(result.current.isDue).toBe(true);
    });
    expect(gateway.requestPermission).not.toHaveBeenCalled();
  });

  it('안내를 마치면 같은 계정·활성화 시점에는 다시 묻지 않는다', async () => {
    // Given
    const { wrapper } = setup();
    const { result } = await renderHook(() => usePushPermissionAskMoment(), { wrapper });
    await waitFor(() => {
      expect(result.current.isDue).toBe(true);
    });

    // When
    await act(() => result.current.complete());

    // Then
    expect(result.current.isDue).toBe(false);
  });

  it('이미 허용하거나 거절한 사용자에게는 묻지 않는다', async () => {
    // Given
    const { gateway, wrapper } = setup({ permissionStatus: 'denied' });

    // When
    const { result } = await renderHook(() => usePushPermissionAskMoment(), { wrapper });

    // Then
    await waitFor(() => {
      expect(gateway.getPermission).toHaveBeenCalled();
    });
    expect(result.current.isDue).toBe(false);
  });

  it('활성화 전 신규 사용자에게는 묻지 않고, 활성화하면 그때 안내한다', async () => {
    // Given
    const { gateway, wrapper, activate } = setup({ userCreatedAt: NEW_USER_CREATED_AT });
    const { result } = await renderHook(() => usePushPermissionAskMoment(), {
      wrapper,
    });
    await waitFor(() => {
      expect(gateway.getPermission).toHaveBeenCalled();
    });
    expect(result.current.isDue).toBe(false);

    // When
    await act(() => activate());

    // Then
    await waitFor(() => {
      expect(result.current.isDue).toBe(true);
    });
  });

  it('/me 조회가 실패해도 기존 권한 요청 흐름을 막지 않는다', async () => {
    // Given
    const { wrapper } = setup({ isUserLoadable: false });

    // When
    const { result } = await renderHook(() => usePushPermissionAskMoment(), { wrapper });

    // Then
    await waitFor(() => {
      expect(result.current.isDue).toBe(true);
    });
  });
});

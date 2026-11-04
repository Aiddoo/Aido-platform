import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { Logger } from '@src/core/ports/logger';
import type { FeatureDiscoveryConfig } from '@src/features/feature-discovery/domains/feature-discovery.model';
import {
  createPushDeviceResponseDto,
  createPushNotificationGatewayStub,
  createPushPermissionResponse,
} from '@src/features/notification/__tests__/notification.factories';
import { PushDeviceService } from '@src/features/notification/apis/push-device.service';
import { createMockDIContainer, createMockHttpClient } from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { QueryClientProvider } from '@tanstack/react-query';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import type { ActivationProgress, ActivationUser } from '../domains/activation.model';
import { useAutomaticPushPermissionRequest } from './use-automatic-push-permission-request';

type ActivationState = {
  config: FeatureDiscoveryConfig | undefined;
  user: ActivationUser | undefined;
  progress: ActivationProgress;
  isReady: boolean;
  isAuthenticated: boolean;
  hasUserError: boolean;
};

const EXISTING_USER_STATE: ActivationState = {
  config: {
    enabled: true as const,
    campaignId: 'feature-discovery-2026-08',
    minAppVersion: '1.8.0',
    launchedAt: new Date('2026-08-01T00:00:00.000Z'),
    autoOpen: true,
  },
  user: { id: 'existing-user', createdAt: new Date('2026-07-01T00:00:00.000Z') },
  progress: { todoCreatedAt: null, activatedAt: null, pushRegistrationUnlockedAt: null },
  isReady: true,
  isAuthenticated: true,
  hasUserError: false,
};
const NEW_USER = { id: 'new-user', createdAt: new Date('2026-08-01T00:00:00.000Z') };

let mockActivationState = EXISTING_USER_STATE;

jest.mock('./use-activation-progress', () => ({
  useActivationProgress: () => mockActivationState,
}));

const silentLogger: Logger = { debug: () => {}, info: () => {}, warn: () => {}, error: () => {} };

function setup(permissionStatus: 'undetermined' | 'granted' | 'denied' = 'undetermined') {
  const gateway = createPushNotificationGatewayStub({
    getPermission: jest.fn(async () =>
      createPushPermissionResponse({ status: permissionStatus, canAskAgain: true }),
    ),
  });
  const httpClient = createMockHttpClient();
  httpClient.put.mockResolvedValue({ ok: true, value: createPushDeviceResponseDto() });
  const pushDeviceService = new PushDeviceService(
    gateway,
    { get: async () => 'ios_device-123' },
    httpClient,
    silentLogger,
  );
  const container = createMockDIContainer({ pushDeviceService, logger: silentLogger });
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StaticDIProvider>
  );
  return { gateway, wrapper };
}

describe('useAutomaticPushPermissionRequest', () => {
  beforeEach(() => {
    mockActivationState = EXISTING_USER_STATE;
  });

  it('기존 사용자가 아직 알림 권한을 정하지 않았으면 로그인하자마자 한 번 묻는다', async () => {
    // Given
    const { gateway, wrapper } = setup('undetermined');

    // When
    await renderHook(() => useAutomaticPushPermissionRequest(), { wrapper });

    // Then
    await waitFor(() => {
      expect(gateway.requestPermission).toHaveBeenCalledTimes(1);
    });
  });

  it('이미 허용하거나 거절한 사용자에게는 시스템 창을 다시 띄우지 않는다', async () => {
    // Given
    const { gateway, wrapper } = setup('denied');

    // When
    await renderHook(() => useAutomaticPushPermissionRequest(), { wrapper });

    // Then
    await waitFor(() => {
      expect(gateway.getPermission).toHaveBeenCalled();
    });
    expect(gateway.requestPermission).not.toHaveBeenCalled();
  });

  it('활성화 전 신규 사용자에게는 묻지 않고, 활성화하면 그때 묻는다', async () => {
    // Given
    mockActivationState = { ...EXISTING_USER_STATE, user: NEW_USER };
    const { gateway, wrapper } = setup('undetermined');
    const { rerender } = await renderHook(() => useAutomaticPushPermissionRequest(), { wrapper });
    await waitFor(() => {
      expect(gateway.getPermission).toHaveBeenCalled();
    });
    expect(gateway.requestPermission).not.toHaveBeenCalled();

    // When
    mockActivationState = {
      ...mockActivationState,
      progress: {
        ...mockActivationState.progress,
        activatedAt: new Date('2026-08-02T00:00:00.000Z'),
      },
    };
    await rerender(undefined);

    // Then
    await waitFor(() => {
      expect(gateway.requestPermission).toHaveBeenCalledTimes(1);
    });
  });

  it('/me 조회가 실패해도 기존 권한 요청 흐름을 막지 않는다', async () => {
    // Given
    mockActivationState = {
      ...EXISTING_USER_STATE,
      user: undefined,
      isReady: false,
      hasUserError: true,
    };
    const { gateway, wrapper } = setup('undetermined');

    // When
    await renderHook(() => useAutomaticPushPermissionRequest(), { wrapper });

    // Then
    await waitFor(() => {
      expect(gateway.requestPermission).toHaveBeenCalledTimes(1);
    });
  });
});

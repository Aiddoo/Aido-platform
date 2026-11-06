import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import type { Logger } from '@src/core/ports/logger';
import type { WhatsNewConfig } from '@src/features/app-config/whats-new/domains/whats-new.model';
import {
  createPushDeviceResponseDto,
  createPushNotificationGatewayStub,
  createPushPermissionResponse,
} from '@src/features/notification/__tests__/notification.factories';
import { PushDeviceService } from '@src/features/notification/apis/push-device.service';
import { createTestDiContainer, createHttpClientStub } from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import type { ActivationProgress, ActivationUser } from '../domains/activation.model';
import { usePushPermissionAskMoment } from './use-push-permission-ask-moment';

type ActivationState = {
  config: WhatsNewConfig | undefined;
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
  const httpClient = createHttpClientStub();
  httpClient.put.mockResolvedValue({ ok: true, value: createPushDeviceResponseDto() });
  const pushDeviceService = new PushDeviceService(
    gateway,
    { get: async () => 'ios_device-123' },
    httpClient,
    silentLogger,
    () => 'Asia/Seoul',
  );
  const container = createTestDiContainer({ pushDeviceService, logger: silentLogger });
  const queryClient = createTestQueryClient();
  const wrapper = ({ children }: PropsWithChildren) => (
    <StaticDIProvider container={container}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </StaticDIProvider>
  );
  return { gateway, wrapper };
}

describe('usePushPermissionAskMoment', () => {
  beforeEach(() => {
    mockActivationState = EXISTING_USER_STATE;
  });

  it('기존 사용자가 아직 알림 권한을 정하지 않았으면 로그인하자마자 안내할 차례가 된다', async () => {
    // Given
    const { gateway, wrapper } = setup('undetermined');

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
    const { wrapper } = setup('undetermined');
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
    const { gateway, wrapper } = setup('denied');

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
    mockActivationState = { ...EXISTING_USER_STATE, user: NEW_USER };
    const { gateway, wrapper } = setup('undetermined');
    const { result, rerender } = await renderHook(() => usePushPermissionAskMoment(), {
      wrapper,
    });
    await waitFor(() => {
      expect(gateway.getPermission).toHaveBeenCalled();
    });
    expect(result.current.isDue).toBe(false);

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
      expect(result.current.isDue).toBe(true);
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
    const { wrapper } = setup('undetermined');

    // When
    const { result } = await renderHook(() => usePushPermissionAskMoment(), { wrapper });

    // Then
    await waitFor(() => {
      expect(result.current.isDue).toBe(true);
    });
  });
});

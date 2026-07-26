import type { FeatureDiscoveryConfig } from '@src/features/feature-discovery/models/feature-discovery.model';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { ActivationProgress, ActivationUser } from '../../models/activation.model';
import { useAutomaticPushRegistration } from './use-automatic-push-registration';

const mockSetupPushNotifications = jest.fn();
const mockWarn = jest.fn();

let mockActivationState: {
  config: FeatureDiscoveryConfig | undefined;
  user: ActivationUser | undefined;
  progress: ActivationProgress;
  isReady: boolean;
  isAuthenticated: boolean;
  hasUserError: boolean;
} = {
  config: {
    enabled: true as const,
    campaignId: 'feature-discovery-2026-08',
    minAppVersion: '1.8.0',
    launchedAt: new Date('2026-08-01T00:00:00.000Z'),
    autoOpen: true,
  },
  user: {
    id: 'existing-user',
    createdAt: new Date('2026-07-01T00:00:00.000Z'),
  },
  progress: {
    todoCreatedAt: null,
    activatedAt: null,
    pushRegistrationUnlockedAt: null,
  },
  isReady: true,
  isAuthenticated: true,
  hasUserError: false,
};

jest.mock('@src/bootstrap/providers/di-context', () => ({
  useNotificationService: () => ({ setupPushNotifications: mockSetupPushNotifications }),
  useLogger: () => ({ warn: mockWarn }),
}));

jest.mock('./use-activation-progress', () => ({
  useActivationProgress: () => mockActivationState,
}));

describe('useAutomaticPushRegistration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockActivationState = {
      ...mockActivationState,
      user: {
        id: 'existing-user',
        createdAt: new Date('2026-07-01T00:00:00.000Z'),
      },
      progress: {
        todoCreatedAt: null,
        activatedAt: null,
        pushRegistrationUnlockedAt: null,
      },
      isReady: true,
      isAuthenticated: true,
      hasUserError: false,
    };
    mockSetupPushNotifications.mockResolvedValue({ ok: true, value: { registered: true } });
  });

  it('기존 사용자는 컨텍스트와 무관하게 허용된 토큰을 즉시 재등록하고 기존 권한 흐름도 유지한다', async () => {
    // When
    await renderHook(() => useAutomaticPushRegistration());

    // Then
    await waitFor(() => {
      expect(mockSetupPushNotifications).toHaveBeenCalledWith({ requestPermission: false });
      expect(mockSetupPushNotifications).toHaveBeenCalledWith();
    });
  });

  it('미활성 신규 사용자는 자동 등록하지 않는다', async () => {
    // Given
    mockActivationState = {
      ...mockActivationState,
      user: {
        id: 'new-user',
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    };

    // When
    await renderHook(() => useAutomaticPushRegistration());

    // Then
    await waitFor(() => {
      expect(mockSetupPushNotifications).toHaveBeenCalledTimes(1);
      expect(mockSetupPushNotifications).toHaveBeenCalledWith({ requestPermission: false });
    });
  });

  it('신규 사용자가 활성화되면 자동 등록을 한 번 시작한다', async () => {
    // Given
    mockActivationState = {
      ...mockActivationState,
      user: {
        id: 'new-user',
        createdAt: new Date('2026-08-01T00:00:00.000Z'),
      },
    };
    const { rerender } = await renderHook(() => useAutomaticPushRegistration());

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
      expect(mockSetupPushNotifications).toHaveBeenCalledWith();
    });
  });

  it('같은 사용자가 로그아웃 후 다시 로그인하면 다시 등록한다', async () => {
    // Given
    const { rerender } = await renderHook(() => useAutomaticPushRegistration());
    await waitFor(() => {
      expect(mockSetupPushNotifications).toHaveBeenCalledWith();
    });

    // When
    mockActivationState = { ...mockActivationState, isReady: false };
    await rerender(undefined);
    mockActivationState = { ...mockActivationState, isReady: true };
    await rerender(undefined);

    // Then
    await waitFor(() => {
      expect(
        mockSetupPushNotifications.mock.calls.filter((args) => args.length === 0),
      ).toHaveLength(2);
    });
  });

  it('설정 API 오류 중에도 출시 전 기존 사용자는 자동 등록을 유지한다', async () => {
    // Given
    mockActivationState = {
      ...mockActivationState,
      config: undefined,
      user: {
        id: 'existing-user',
        createdAt: new Date('2026-07-31T23:59:59.999Z'),
      },
    };

    // When
    await renderHook(() => useAutomaticPushRegistration());

    // Then
    await waitFor(() => {
      expect(mockSetupPushNotifications).toHaveBeenCalledWith();
    });
  });

  it('/me 네트워크 또는 Zod 오류가 나도 기존 권한 등록 흐름을 영구 차단하지 않는다', async () => {
    // Given
    mockActivationState = {
      ...mockActivationState,
      user: undefined,
      isReady: false,
      hasUserError: true,
    };

    // When
    await renderHook(() => useAutomaticPushRegistration());

    // Then
    await waitFor(() => {
      expect(mockSetupPushNotifications).toHaveBeenCalledWith({ requestPermission: false });
      expect(mockSetupPushNotifications).toHaveBeenCalledWith();
    });
  });
});

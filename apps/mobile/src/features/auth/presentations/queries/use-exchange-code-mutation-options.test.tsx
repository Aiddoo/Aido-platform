import { renderHook } from '@testing-library/react-native';

import { useExchangeCodeMutationOptions } from './use-exchange-code-mutation-options';

const mockSetStatus = jest.fn();
const mockSetupPushNotifications = jest.fn();
const mockTrackEvent = jest.fn();

jest.mock('@src/bootstrap/providers/auth-provider', () => ({
  useAuth: () => ({ setStatus: mockSetStatus }),
}));

jest.mock('@src/bootstrap/providers/di-context', () => ({
  useAuthService: () => ({ exchangeCode: jest.fn() }),
  useNotificationService: () => ({ setupPushNotifications: mockSetupPushNotifications }),
  useLogger: () => ({ warn: jest.fn() }),
}));

jest.mock('@src/shared/analytics', () => ({
  useTrack: () => ({ trackEvent: mockTrackEvent }),
}));

jest.mock('@src/shared/hooks/useAppToast', () => ({
  useAppToast: () => ({ success: jest.fn() }),
}));

jest.mock('@src/shared/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('expo-haptics', () => ({
  notificationAsync: jest.fn(),
  NotificationFeedbackType: { Error: 'error' },
}));

describe('useExchangeCodeMutationOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetupPushNotifications.mockResolvedValue({ ok: true, value: { registered: true } });
  });

  it('OAuth 성공은 인증만 완료하고 푸시 결정은 공용 게이트에 맡긴다', async () => {
    // Given
    const { result } = await renderHook(() => useExchangeCodeMutationOptions());
    const onSuccess = result.current.onSuccess as (...args: unknown[]) => Promise<void> | void;

    // When
    await onSuccess(
      { accountRestored: false },
      { code: 'exchange-code', provider: 'google' },
      undefined,
      undefined,
    );

    // Then
    expect(mockSetStatus).toHaveBeenCalledWith('authenticated');
    expect(mockSetupPushNotifications).not.toHaveBeenCalled();
    expect(mockTrackEvent).toHaveBeenCalledWith('auth_login', { method: 'google' });
  });
});

import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderHook } from '@testing-library/react-native';

import { createAuthTokens } from '../__tests__/auth.factories';
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

jest.mock('@src/shared/hooks/use-app-toast', () => ({
  useAppToast: () => ({ success: jest.fn() }),
}));

jest.mock('@src/shared/i18n', () => ({
  t: (key: string) => key,
}));

jest.mock('@src/shared/utils/haptics');

const MUTATION_CONTEXT = { client: createTestQueryClient(), meta: undefined };

describe('useExchangeCodeMutationOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSetupPushNotifications.mockResolvedValue({ ok: true, value: { registered: true } });
  });

  it('OAuth 성공은 인증만 완료하고 푸시 결정은 공용 게이트에 맡긴다', async () => {
    // Given
    const { result } = await renderHook(() => useExchangeCodeMutationOptions());

    // When
    await result.current.onSuccess?.(
      createAuthTokens(),
      { code: 'exchange-code', provider: 'google' },
      undefined,
      MUTATION_CONTEXT,
    );

    // Then
    expect(mockSetStatus).toHaveBeenCalledWith('authenticated');
    expect(mockSetupPushNotifications).not.toHaveBeenCalled();
  });

  it('기존 계정 로그인은 auth_login만 보낸다', async () => {
    // Given
    const { result } = await renderHook(() => useExchangeCodeMutationOptions());

    // When
    await result.current.onSuccess?.(
      createAuthTokens({ isNewUser: false }),
      { code: 'exchange-code', provider: 'google' },
      undefined,
      MUTATION_CONTEXT,
    );

    // Then
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith('auth_login', { method: 'google' });
  });

  it('신규 가입은 auth_signup만 보낸다', async () => {
    // Given
    const { result } = await renderHook(() => useExchangeCodeMutationOptions());

    // When
    await result.current.onSuccess?.(
      createAuthTokens({ isNewUser: true }),
      { code: 'exchange-code', provider: 'kakao' },
      undefined,
      MUTATION_CONTEXT,
    );

    // Then
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith('auth_signup', { method: 'kakao' });
  });
});

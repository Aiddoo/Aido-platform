import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { renderHook } from '@testing-library/react-native';

import { createAuthTokens } from '../__tests__/auth.fixtures';
import { useOpenAppleLoginMutationOptions } from './use-open-apple-login-mutation-options';

const mockSetStatus = jest.fn();
const mockTrackEvent = jest.fn();

jest.mock('@src/bootstrap/providers/auth-provider', () => ({
  useAuth: () => ({ setStatus: mockSetStatus }),
}));

jest.mock('@src/bootstrap/providers/di-context', () => ({
  useHaptics: () => ({ selection: jest.fn(), impact: jest.fn(), notify: jest.fn() }),
  useAuthService: () => ({ openAppleLogin: jest.fn() }),
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

const MUTATION_CONTEXT = { client: createTestQueryClient(), meta: undefined };

describe('useOpenAppleLoginMutationOptions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('기존 계정 로그인은 auth_login만 보낸다', async () => {
    // Given
    const { result } = await renderHook(() => useOpenAppleLoginMutationOptions());

    // When
    await result.current.onSuccess?.(
      createAuthTokens({ isNewUser: false }),
      undefined,
      undefined,
      MUTATION_CONTEXT,
    );

    // Then
    expect(mockSetStatus).toHaveBeenCalledWith('authenticated');
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith('auth_login', { method: 'apple' });
  });

  it('신규 가입은 auth_signup만 보낸다', async () => {
    // Given
    const { result } = await renderHook(() => useOpenAppleLoginMutationOptions());

    // When
    await result.current.onSuccess?.(
      createAuthTokens({ isNewUser: true }),
      undefined,
      undefined,
      MUTATION_CONTEXT,
    );

    // Then
    expect(mockTrackEvent).toHaveBeenCalledTimes(1);
    expect(mockTrackEvent).toHaveBeenCalledWith('auth_signup', { method: 'apple' });
  });
});

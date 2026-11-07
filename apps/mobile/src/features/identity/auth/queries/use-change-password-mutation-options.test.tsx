import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import {
  createTestDiContainer,
  createHttpClientStub,
  createMockTokenStore,
  createSocialAuthGatewayStub,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { NetworkError } from '@src/shared/errors';
import { QueryClientProvider } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { createAuthApiError } from '../__tests__/auth.fixtures';
import { AuthService } from '../apis/auth.service';
import { useChangePasswordMutationOptions } from './use-change-password-mutation-options';

const mockToastError = jest.fn();

jest.mock('@src/shared/hooks/use-app-toast', () => ({
  useAppToast: () => ({ success: jest.fn(), error: mockToastError }),
}));
jest.mock('expo-router', () => ({ router: { back: jest.fn() } }));

const input = {
  currentPassword: 'current-pass1!',
  newPassword: 'new-pass1234!',
  newPasswordConfirm: 'new-pass1234!',
};

describe('비밀번호 변경 실패 안내', () => {
  let client: QueryClient;
  let authHttp: ReturnType<typeof createHttpClientStub>;
  let unmount: (() => Promise<void>) | undefined;

  beforeEach(() => {
    client = createTestQueryClient();
    authHttp = createHttpClientStub();
    unmount = undefined;
  });

  afterEach(async () => {
    await unmount?.();
  });

  const changePassword = async () => {
    const authService = new AuthService(
      createHttpClientStub(),
      authHttp,
      createMockTokenStore(),
      createSocialAuthGatewayStub(),
    );
    const container = createTestDiContainer({ authService });
    const rendered = await renderHook(() => useChangePasswordMutationOptions(), {
      wrapper: ({ children }: PropsWithChildren) => (
        <StaticDIProvider container={container}>
          <QueryClientProvider client={client}>{children}</QueryClientProvider>
        </StaticDIProvider>
      ),
    });
    unmount = rendered.unmount;
    const mutation = client.getMutationCache().build(client, rendered.result.current);
    await act(async () => {
      await mutation.execute(input).catch(() => undefined);
    });
  };

  it('서버가 거절한 변경은 toast로 이유를 알린다', async () => {
    // Given
    const apiError = createAuthApiError({ status: 400 });
    authHttp.patch.mockResolvedValue({ ok: false, error: apiError });

    // When
    await changePassword();

    // Then
    expect(mockToastError).toHaveBeenCalledWith(apiError, expect.anything());
  });

  it('네트워크 오류도 오류 화면으로 바꾸지 않고 toast 한 번으로 알린다', async () => {
    // Given
    authHttp.patch.mockRejectedValue(new NetworkError());

    // When
    await changePassword();

    // Then
    expect(mockToastError).toHaveBeenCalledTimes(1);
  });
});

import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import { createMockDIContainer } from '@src/shared/__tests__';
import { NetworkError } from '@src/shared/errors';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { createAuthApiError } from '../__tests__/auth.factories';
import type { AuthService } from '../apis/auth.service';
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
  let changePasswordRequest: jest.MockedFunction<AuthService['changePassword']>;
  let unmount: (() => Promise<void>) | undefined;

  beforeEach(() => {
    client = new QueryClient({
      defaultOptions: { mutations: { retry: false, gcTime: Infinity } },
    });
    changePasswordRequest = jest.fn();
    unmount = undefined;
  });

  afterEach(async () => {
    await unmount?.();
    client.clear();
  });

  const changePassword = async () => {
    const authService = { changePassword: changePasswordRequest } as unknown as AuthService;
    const container = createMockDIContainer({ authService });
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
    changePasswordRequest.mockResolvedValue({ ok: false, error: apiError });

    // When
    await changePassword();

    // Then
    expect(mockToastError).toHaveBeenCalledWith(apiError, expect.anything());
  });

  it('네트워크 오류는 화면 오류 경계에 맡기고 toast를 띄우지 않는다', async () => {
    // Given
    changePasswordRequest.mockRejectedValue(new NetworkError());

    // When
    await changePassword();

    // Then
    expect(mockToastError).not.toHaveBeenCalled();
  });
});

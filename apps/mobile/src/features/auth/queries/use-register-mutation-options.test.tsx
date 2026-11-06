import '@src/shared/i18n/init';
import { StaticDIProvider } from '@src/bootstrap/providers/di-context';
import {
  createMockAnalytics,
  createMockDIContainer,
  createMockHttpClient,
  createMockTokenStore,
} from '@src/shared/__tests__';
import { createTestQueryClient } from '@src/shared/__tests__/query-client';
import { QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';

import { createRegisterDto } from '../__tests__/auth.factories';
import { AuthService } from '../apis/auth.service';
import { useRegisterMutationOptions } from './use-register-mutation-options';

const mockToastWarning = jest.fn();

jest.mock('@src/shared/hooks/use-app-toast', () => ({
  useAppToast: () => ({ success: jest.fn(), error: jest.fn(), warning: mockToastWarning }),
}));
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));

const input = {
  email: 'test@example.com',
  password: 'pass1234!',
  passwordConfirm: 'pass1234!',
  name: '테스트',
  termsAgreed: true,
  privacyAgreed: true,
  marketingAgreed: false,
} as const;

async function register(dto: ReturnType<typeof createRegisterDto>) {
  const client = createTestQueryClient();
  const publicHttp = createMockHttpClient();
  publicHttp.post.mockResolvedValue({ ok: true, value: dto });
  const container = createMockDIContainer({
    authService: new AuthService(publicHttp, createMockHttpClient(), createMockTokenStore()),
    analytics: createMockAnalytics(),
  });
  const { result } = await renderHook(() => useRegisterMutationOptions(), {
    wrapper: ({ children }: PropsWithChildren) => (
      <StaticDIProvider container={container}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </StaticDIProvider>
    ),
  });
  const mutation = client.getMutationCache().build(client, result.current);
  await act(async () => {
    await mutation.execute(input);
  });
}

describe('회원가입 인증 메일', () => {
  test('메일을 보내지 못했으면 가입은 성공이고 재발송을 안내한다', async () => {
    // Given
    const dto = createRegisterDto({ emailSent: false });

    // When
    await register(dto);

    // Then
    expect(mockToastWarning).toHaveBeenCalledWith(
      '가입은 됐지만 인증 메일을 보내지 못했어요. 잠시 후 다시 보내기를 눌러주세요',
    );
  });

  test('메일을 보냈으면 따로 알리지 않는다', async () => {
    // Given
    const dto = createRegisterDto({ emailSent: true });

    // When
    await register(dto);

    // Then
    expect(mockToastWarning).not.toHaveBeenCalled();
  });
});

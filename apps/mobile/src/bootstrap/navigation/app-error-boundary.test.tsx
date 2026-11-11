import { resolveInitialAuthStatus } from '@src/bootstrap/auth/resolve-initial-auth-status';
import { ok } from '@src/core/errors/result';
import {
  ACCOUNT_A_TOKENS,
  createAuthSession,
} from '@src/features/identity/auth/__tests__/auth-session.test-utils';
import { useAuthStatus } from '@src/features/identity/auth/hooks/use-auth-status';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Text } from 'react-native';

import { ErrorBoundary } from '../../../app/(app)/_layout';

const StatusProbe = () => <Text testID="status">{useAuthStatus()}</Text>;

beforeEach(() => {
  // oxlint-disable-next-line jest/no-restricted-jest-methods -- 1.15.2 전환 #1400
  jest.useFakeTimers();
});

afterEach(() => {
  jest.clearAllTimers();
  // oxlint-disable-next-line jest/no-restricted-jest-methods -- 1.15.2 전환 #1400
  jest.useRealTimers();
});

describe('앱 오류 화면의 로그아웃', () => {
  it('토큰을 지워 다시 열어도 로그아웃 상태다', async () => {
    // Given
    const session = createAuthSession({ tokens: ACCOUNT_A_TOKENS });
    session.authHttp.delete.mockResolvedValue(ok({}));
    session.authHttp.post.mockResolvedValue(ok({ message: '로그아웃되었습니다.' }));
    await render(
      <>
        <StatusProbe />
        <ErrorBoundary error={new Error('화면 오류')} retry={jest.fn()} />
      </>,
      { wrapper: session.Wrapper },
    );
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('authenticated'));

    // When
    await act(async () => {
      fireEvent.press(screen.getByText('로그아웃'));
      await jest.runOnlyPendingTimersAsync();
    });

    // Then
    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('unauthenticated'));
    await expect(session.tokenStore.getRefreshToken()).resolves.toBeNull();
    await expect(resolveInitialAuthStatus(session.tokenStore)).resolves.toBe('unauthenticated');
    expect(session.authHttp.post).toHaveBeenCalledWith(
      'v1/auth/logout',
      undefined,
      expect.objectContaining({ timeout: expect.any(Number) }),
    );
  });
});

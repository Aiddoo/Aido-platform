/**
 * useGetMe Hook Tests
 *
 * 현재 로그인된 사용자 정보 조회 Hook의 동작을 검증합니다.
 * useSuspenseQuery를 사용하므로 Suspense 경계가 필요합니다.
 *
 * 참고: 토큰 체크는 Stack.Protected 가드에서 처리하므로
 * 이 훅은 항상 인증된 상태에서만 호출됩니다.
 */

import { AllProvidersWrapper } from '@src/shared/testing/test-utils';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { Suspense } from 'react';
import { Text } from 'react-native';
import { AuthRepositoryStub } from '../../../data/repositories/auth.repository.stub';
import { useGetMe } from '../use-get-me';

describe('useGetMe', () => {
  const authRepositoryStub = new AuthRepositoryStub();

  const wrapper = ({ children }: PropsWithChildren) => (
    <AllProvidersWrapper authRepository={authRepositoryStub}>
      <Suspense fallback={<Text>Loading...</Text>}>{children}</Suspense>
    </AllProvidersWrapper>
  );

  beforeEach(() => {
    authRepositoryStub.reset();
  });

  it('사용자 정보를 조회한다', async () => {
    // When: Hook을 렌더링
    const { result } = renderHook(() => useGetMe(), { wrapper });

    // Then: 사용자 정보가 조회되어야 함
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toEqual({
      userId: expect.any(String),
      email: expect.any(String),
      sessionId: expect.any(String),
      userTag: expect.any(String),
      status: expect.any(String),
      emailVerifiedAt: expect.any(Date),
      subscriptionStatus: expect.any(String),
      subscriptionExpiresAt: null,
      name: expect.any(String),
      profileImage: null,
      createdAt: expect.any(Date),
    });
    expect(authRepositoryStub.getCurrentUserCallCount).toBe(1);
  });
});

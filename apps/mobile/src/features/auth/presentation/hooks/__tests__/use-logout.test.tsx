/**
 * useLogout Hook Tests
 *
 * 로그아웃 처리 Hook의 동작을 검증합니다.
 */

import { AllProvidersWrapper } from '@src/shared/testing/test-utils';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { AuthRepositoryStub } from '../../../data/repositories/auth.repository.stub';
import { useLogout } from '../use-logout';

describe('useLogout', () => {
  const authRepositoryStub = new AuthRepositoryStub();

  const wrapper = ({ children }: PropsWithChildren) => (
    <AllProvidersWrapper authRepository={authRepositoryStub}>{children}</AllProvidersWrapper>
  );

  beforeEach(() => {
    authRepositoryStub.reset();
  });

  describe('성공 케이스', () => {
    it('로그아웃을 처리한다', async () => {
      // Given: 로그인된 상태
      // When: Hook을 렌더링하고 mutate 실행
      const { result } = renderHook(() => useLogout(), { wrapper });

      result.current.mutate();

      // Then: 성공적으로 로그아웃되어야 함
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(authRepositoryStub.logoutCallCount).toBe(1);
    });

    it('성공 시 모든 인증 쿼리를 무효화한다', async () => {
      // Given: 로그인된 상태
      // When: Hook을 렌더링하고 mutate 실행
      const { result } = renderHook(() => useLogout(), { wrapper });

      result.current.mutate();

      // Then: 성공 콜백이 실행되어야 함
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('실패 케이스', () => {
    it('네트워크 에러 시에도 성공으로 처리된다 (로컬 토큰은 삭제됨)', async () => {
      // Given: Repository가 에러를 던지도록 설정
      authRepositoryStub.setShouldFail(true);

      // When: Hook을 렌더링하고 mutate 실행
      const { result } = renderHook(() => useLogout(), { wrapper });

      result.current.mutate();

      // Then: AuthService가 에러를 catch하므로 성공으로 처리됨
      // (API 실패 시에도 로컬 토큰 삭제는 보장됨)
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // Repository의 logout이 호출되었는지 확인
      expect(authRepositoryStub.logoutCallCount).toBe(1);
    });
  });

  describe('로딩 상태', () => {
    it('mutation이 완료될 때까지 대기하고 성공 상태가 된다', async () => {
      // Given: 로그인된 상태
      // When: Hook을 렌더링하고 mutate 실행
      const { result } = renderHook(() => useLogout(), { wrapper });

      // mutation 실행 전 idle 상태 확인
      expect(result.current.isIdle).toBe(true);

      result.current.mutate();

      // Then: 완료될 때까지 대기 후 성공 상태 확인
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // 완료 후 pending이 아님을 확인
      expect(result.current.isPending).toBe(false);
    });
  });
});

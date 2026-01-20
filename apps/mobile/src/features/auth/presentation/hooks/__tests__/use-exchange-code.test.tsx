/**
 * useExchangeCode Hook Tests
 *
 * OAuth 인증 코드 교환 및 토큰 저장 Hook의 동작을 검증합니다.
 */

import { AllProvidersWrapper } from '@src/shared/testing/test-utils';
import { renderHook, waitFor } from '@testing-library/react-native';
import type { PropsWithChildren } from 'react';
import { AuthRepositoryStub } from '../../../data/repositories/auth.repository.stub';
import { useExchangeCode } from '../use-exchange-code';

describe('useExchangeCode', () => {
  const authRepositoryStub = new AuthRepositoryStub();

  const wrapper = ({ children }: PropsWithChildren) => (
    <AllProvidersWrapper authRepository={authRepositoryStub}>{children}</AllProvidersWrapper>
  );

  beforeEach(() => {
    authRepositoryStub.reset();
  });

  describe('성공 케이스', () => {
    it('OAuth 코드를 교환하여 토큰을 저장한다', async () => {
      // Given: OAuth 인증 코드
      const authCode = 'test-auth-code';

      // When: Hook을 렌더링하고 mutate 실행
      const { result } = renderHook(() => useExchangeCode(), { wrapper });

      result.current.mutate(authCode);

      // Then: 성공적으로 토큰이 저장되어야 함
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(authRepositoryStub.exchangeCodeCallCount).toBe(1);
      expect(authRepositoryStub.lastExchangeCodeParams).toEqual({
        code: authCode,
      });
    });

    it('성공 시 모든 인증 쿼리를 무효화한다', async () => {
      // Given: OAuth 인증 코드
      const authCode = 'test-auth-code';

      // When: Hook을 렌더링하고 mutate 실행
      const { result } = renderHook(() => useExchangeCode(), { wrapper });

      result.current.mutate(authCode);

      // Then: 성공 콜백이 실행되어야 함
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });
    });
  });

  describe('실패 케이스', () => {
    it('네트워크 에러 시 에러 상태를 반환한다', async () => {
      // Given: Repository가 에러를 던지도록 설정
      authRepositoryStub.setShouldFail(true);
      const authCode = 'test-auth-code';

      // When: Hook을 렌더링하고 mutate 실행
      const { result } = renderHook(() => useExchangeCode(), { wrapper });

      result.current.mutate(authCode);

      // Then: 에러 상태가 설정되어야 함
      await waitFor(() => {
        expect(result.current.isError).toBe(true);
      });

      expect(result.current.error).toBeDefined();
    });
  });

  describe('로딩 상태', () => {
    it('mutation이 완료될 때까지 대기하고 성공 상태가 된다', async () => {
      // Given: OAuth 인증 코드
      const authCode = 'test-auth-code';

      // When: Hook을 렌더링하고 mutate 실행
      const { result } = renderHook(() => useExchangeCode(), { wrapper });

      // mutation 실행 전 idle 상태 확인
      expect(result.current.isIdle).toBe(true);

      result.current.mutate(authCode);

      // Then: 완료될 때까지 대기 후 성공 상태 확인
      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      // 완료 후 pending이 아님을 확인
      expect(result.current.isPending).toBe(false);
    });
  });
});

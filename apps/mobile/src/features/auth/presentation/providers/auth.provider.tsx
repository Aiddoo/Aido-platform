/**
 * Auth Provider (Presentation Layer)
 *
 * 세션 상태 관리를 담당하는 Context Provider입니다.
 * useState lazy initialization을 사용하여 의존성을 생성하고 주입합니다.
 *
 * DI 구조:
 * - 프로덕션: core/di/app-providers.tsx에서 authRepository 주입
 * - 테스트: 테스트 코드에서 mock repository 주입
 */

import { useHttpClient } from '@src/core/providers/http-client-provider';
import { createContext, type PropsWithChildren, use, useState } from 'react';
import { AuthService } from '../../application/services/auth.service';
import { AuthRepositoryImpl } from '../../data/repositories/auth.repository.impl';
import type { AuthRepository } from '../../domain/repositories/auth.repository';

// ===== Context =====

export const AuthServiceContext = createContext<AuthService | null>(null);

// ===== Provider =====

interface AuthProviderProps extends PropsWithChildren {
  /**
   * Repository 주입 (optional)
   * - 프로덕션: core/di/container.ts에서 생성된 구현체 주입
   * - 테스트: mock repository 주입
   * - 미제공 시: httpClient를 사용하여 자동 생성
   */
  authRepository?: AuthRepository;
}

export const AuthProvider = ({ children, authRepository }: AuthProviderProps) => {
  const httpClient = useHttpClient();

  const [authService] = useState<AuthService>(() => {
    // 주입된 repository가 있으면 사용, 없으면 실제 구현체 생성
    const repository = authRepository ?? new AuthRepositoryImpl(httpClient);
    return new AuthService(repository);
  });

  return <AuthServiceContext value={authService}>{children}</AuthServiceContext>;
};

// ===== Hook =====

/**
 * AuthService를 사용하기 위한 Hook입니다.
 * AuthProvider 내부에서만 사용할 수 있습니다.
 *
 * @throws {Error} AuthProvider 외부에서 사용 시
 */
export const useAuthService = (): AuthService => {
  const context = use(AuthServiceContext);

  if (!context) {
    throw new Error('useAuthService must be used within AuthProvider');
  }

  return context;
};

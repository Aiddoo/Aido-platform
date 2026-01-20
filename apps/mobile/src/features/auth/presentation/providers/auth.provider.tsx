import { useHttpClient } from '@src/core/providers/http-client-provider';
import { createContext, type PropsWithChildren, use, useState } from 'react';
import { AuthService } from '../../application/services/auth.service';
import { AuthRepositoryImpl } from '../../data/repositories/auth.repository.impl';
import type { AuthRepository } from '../../domain/repositories/auth.repository';

export const AuthServiceContext = createContext<AuthService | null>(null);

interface AuthProviderProps extends PropsWithChildren {
  authRepository?: AuthRepository;
}

export const AuthProvider = ({ children, authRepository }: AuthProviderProps) => {
  const httpClient = useHttpClient();

  const [authService] = useState<AuthService>(() => {
    const repository = authRepository ?? new AuthRepositoryImpl(httpClient);
    return new AuthService(repository);
  });

  return <AuthServiceContext value={authService}>{children}</AuthServiceContext>;
};

export const useAuthService = (): AuthService => {
  const context = use(AuthServiceContext);

  if (!context) {
    throw new Error('useAuthService must be used within AuthProvider');
  }

  return context;
};

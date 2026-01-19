import { useHttpClient } from '@src/core/providers';
import { createContext, type PropsWithChildren, use, useState } from 'react';
import { AuthRepositoryImpl } from '../../repositories/auth-repository.impl';
import { AuthService } from '../../services/auth.service';

export interface AuthClient {
  authService: AuthService;
}

interface AuthProviderProps extends PropsWithChildren {
  client?: AuthClient;
}

const AuthContext = createContext<AuthClient | null>(null);

export const AuthProvider = ({ children, client }: AuthProviderProps) => {
  const httpClient = useHttpClient();

  const [authClient] = useState<AuthClient>(() => {
    if (client) return client;

    const authRepository = new AuthRepositoryImpl(httpClient);
    const authService = new AuthService(authRepository);

    return { authService };
  });

  return <AuthContext value={authClient}>{children}</AuthContext>;
};

export const useAuthClient = (): AuthClient => {
  const context = use(AuthContext);

  if (!context) {
    throw new Error('useAuthClient must be used within AuthProvider');
  }

  return context;
};

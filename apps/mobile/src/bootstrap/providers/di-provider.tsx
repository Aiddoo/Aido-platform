import type { Storage } from '@src/core/ports/storage';
import { AuthRepositoryImpl } from '@src/features/auth/repositories/auth.repository.impl';
import { AuthService } from '@src/features/auth/services/auth.service';
import { FriendRepositoryImpl } from '@src/features/friend/repositories/friend.repository.impl';
import { FriendService } from '@src/features/friend/services/friend.service';
import { createAuthClient } from '@src/shared/infra/http/auth-client';
import { KyHttpClient } from '@src/shared/infra/http/ky-http-client';
import { createPublicClient } from '@src/shared/infra/http/public-client';
import { SecureStorage } from '@src/shared/infra/storage/secure-storage';

import { createContext, type PropsWithChildren, use, useState } from 'react';

export interface DIContainer {
  // Infrastructure
  storage: Storage;

  // Services
  authService: AuthService;
  friendService: FriendService;
}

const DIContext = createContext<DIContainer | null>(null);

export const DIProvider = ({ children }: PropsWithChildren) => {
  const [di] = useState<DIContainer>(() => {
    // infrastructure
    const storage = new SecureStorage();

    // 공개 API용 클라이언트 (토큰 불필요)
    const publicKyInstance = createPublicClient();
    const publicHttpClient = new KyHttpClient(publicKyInstance);

    // 인증 API용 클라이언트 (토큰 자동 첨부)
    const authKyInstance = createAuthClient(storage);
    const authHttpClient = new KyHttpClient(authKyInstance);

    // repositories
    const authRepository = new AuthRepositoryImpl(publicHttpClient, authHttpClient, storage);
    const friendRepository = new FriendRepositoryImpl(authHttpClient);

    // services
    const authService = new AuthService(authRepository);
    const friendService = new FriendService(friendRepository);

    return {
      storage,
      authService,
      friendService,
    };
  });

  return <DIContext.Provider value={di}>{children}</DIContext.Provider>;
};

export const useDI = (): DIContainer => {
  const context = use(DIContext);

  if (!context) {
    throw new Error('useDI must be used within DIProvider');
  }

  return context;
};

// Infrastructure Hooks
export const useStorage = () => useDI().storage;

// Service Hooks
export const useAuthService = () => useDI().authService;
export const useFriendService = () => useDI().friendService;

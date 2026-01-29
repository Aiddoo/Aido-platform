import type { Storage } from '@src/core/ports/storage';
import { AuthRepositoryImpl } from '@src/features/auth/repositories/auth.repository.impl';
import { AuthService } from '@src/features/auth/services/auth.service';
import { FriendRepositoryImpl } from '@src/features/friend/repositories/friend.repository.impl';
import { FriendService } from '@src/features/friend/services/friend.service';
import { TodoRepositoryImpl } from '@src/features/todo/repositories/todo.repository.impl';
import { TodoService } from '@src/features/todo/services/todo.service';
import { TodoCategoryRepositoryImpl } from '@src/features/todo-category/repositories/todo-category.repository.impl';
import { TodoCategoryService } from '@src/features/todo-category/services/todo-category.service';
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
  todoService: TodoService;
  todoCategoryService: TodoCategoryService;
}

const DIContext = createContext<DIContainer | null>(null);

export const DIProvider = ({ children }: PropsWithChildren) => {
  const [di] = useState<DIContainer>(() => {
    const storage = new SecureStorage();

    const publicKyInstance = createPublicClient();
    const publicHttpClient = new KyHttpClient(publicKyInstance);

    const authKyInstance = createAuthClient(storage);
    const authHttpClient = new KyHttpClient(authKyInstance);

    const authRepository = new AuthRepositoryImpl(publicHttpClient, authHttpClient, storage);
    const friendRepository = new FriendRepositoryImpl(authHttpClient);
    const todoRepository = new TodoRepositoryImpl(authHttpClient);
    const todoCategoryRepository = new TodoCategoryRepositoryImpl(authHttpClient);

    const authService = new AuthService(authRepository);
    const friendService = new FriendService(friendRepository);
    const todoService = new TodoService(todoRepository);
    const todoCategoryService = new TodoCategoryService(todoCategoryRepository);

    return {
      storage,
      authService,
      friendService,
      todoService,
      todoCategoryService,
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
export const useTodoService = () => useDI().todoService;
export const useTodoCategoryService = () => useDI().todoCategoryService;

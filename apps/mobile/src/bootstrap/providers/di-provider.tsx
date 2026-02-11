import type { Storage } from '@src/core/ports/storage';
import { AuthRepositoryImpl } from '@src/features/auth/repositories/auth.repository.impl';
import { AuthService } from '@src/features/auth/services/auth.service';
import { FriendRepositoryImpl } from '@src/features/friend/repositories/friend.repository.impl';
import { FriendService } from '@src/features/friend/services/friend.service';
import { DeviceIdRepositoryImpl } from '@src/features/notification/repositories/device-id.repository.impl';
import { NotificationRepositoryImpl } from '@src/features/notification/repositories/notification.repository.impl';
import { DeviceIdService } from '@src/features/notification/services/device-id.service';
import { NotificationService } from '@src/features/notification/services/notification.service';
import { PushTokenService } from '@src/features/notification/services/push-token.service';
import { TodoRepositoryImpl } from '@src/features/todo/repositories/todo.repository.impl';
import { TodoCategoryRepositoryImpl } from '@src/features/todo/repositories/todo-category.repository.impl';
import { TodoNudgeRepositoryImpl } from '@src/features/todo/repositories/todo-nudge.repository.impl';
import { TodoService } from '@src/features/todo/services/todo.service';
import { TodoCategoryService } from '@src/features/todo/services/todo-category.service';
import { TodoNudgeService } from '@src/features/todo/services/todo-nudge.service';

import { createAuthClient } from '@src/shared/infra/http/auth-client';
import { KyHttpClient } from '@src/shared/infra/http/ky-client';
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
  notificationService: NotificationService;
  todoNudgeService: TodoNudgeService;
}

const DIContext = createContext<DIContainer | null>(null);

export const DIProvider = ({ children }: PropsWithChildren) => {
  const [di] = useState<DIContainer>(() => {
    const storage = new SecureStorage();

    const publicKyInstance = createPublicClient();
    const publicHttpClient = new KyHttpClient(publicKyInstance);

    const authKyInstance = createAuthClient(storage);
    const authHttpClient = new KyHttpClient(authKyInstance);

    // Auth
    const authRepository = new AuthRepositoryImpl(publicHttpClient, authHttpClient);
    const authService = new AuthService(authRepository, storage);

    // Friend
    const friendRepository = new FriendRepositoryImpl(authHttpClient);
    const friendService = new FriendService(friendRepository);

    // Todo
    const todoRepository = new TodoRepositoryImpl(authHttpClient);
    const todoService = new TodoService(todoRepository);

    // Todo Category
    const todoCategoryRepository = new TodoCategoryRepositoryImpl(authHttpClient);
    const todoCategoryService = new TodoCategoryService(todoCategoryRepository);

    // Notification
    const deviceIdRepository = new DeviceIdRepositoryImpl();
    const notificationRepository = new NotificationRepositoryImpl(authHttpClient);
    const deviceIdService = new DeviceIdService(deviceIdRepository);
    const pushTokenService = new PushTokenService();
    const notificationService = new NotificationService(
      notificationRepository,
      deviceIdService,
      pushTokenService,
    );

    // Todo Nudge
    const todoNudgeRepository = new TodoNudgeRepositoryImpl(authHttpClient);
    const todoNudgeService = new TodoNudgeService(todoNudgeRepository);

    return {
      storage,
      authService,
      friendService,
      todoService,
      todoCategoryService,
      notificationService,
      todoNudgeService,
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
export const useNotificationService = () => useDI().notificationService;
export const useTodoNudgeService = () => useDI().todoNudgeService;

import type { Analytics } from '@src/core/ports/analytics';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { Logger } from '@src/core/ports/logger';
import type { Storage } from '@src/core/ports/storage';
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
import { UserService } from '@src/features/user/services/user.service';

import { ENV } from '@src/shared/config/env';
import { createConsoleAnalytics, createFirebaseAnalytics } from '@src/shared/infra/analytics';
import {
  createConsoleErrorReporter,
  createCrashlyticsErrorReporter,
  initCrashlytics,
} from '@src/shared/infra/error-reporter';
import { createAuthClient } from '@src/shared/infra/http/auth-client';
import { KyHttpClient } from '@src/shared/infra/http/ky-client';
import { createPublicClient } from '@src/shared/infra/http/public-client';
import {
  createCompositeLogger,
  createConsoleLogger,
  createCrashlyticsLogger,
  setGlobalLogger,
} from '@src/shared/infra/logger';
import { SecureStorage } from '@src/shared/infra/storage/secure-storage';

import { createContext, type PropsWithChildren, use, useState } from 'react';

export interface DIContainer {
  // Infrastructure
  storage: Storage;
  logger: Logger;
  analytics: Analytics;
  errorReporter: ErrorReporter;

  // Services
  authService: AuthService;
  friendService: FriendService;
  todoService: TodoService;
  todoCategoryService: TodoCategoryService;
  notificationService: NotificationService;
  todoNudgeService: TodoNudgeService;
  userService: UserService;
}

const DIContext = createContext<DIContainer | null>(null);

export const DIProvider = ({ children }: PropsWithChildren) => {
  const [di] = useState<DIContainer>(() => {
    const storage = new SecureStorage();

    // Observability
    const consoleLogger = createConsoleLogger({ minLevel: ENV.IS_PRODUCTION ? 'warn' : 'debug' });

    if (ENV.IS_PRODUCTION) {
      initCrashlytics(true);
    }

    const logger = ENV.IS_PRODUCTION
      ? createCompositeLogger([consoleLogger, createCrashlyticsLogger()])
      : consoleLogger;

    setGlobalLogger(logger);

    const analytics = ENV.IS_PRODUCTION ? createFirebaseAnalytics() : createConsoleAnalytics();

    const errorReporter = ENV.IS_PRODUCTION
      ? createCrashlyticsErrorReporter()
      : createConsoleErrorReporter();

    const publicKyInstance = createPublicClient();
    const publicHttpClient = new KyHttpClient(publicKyInstance);

    const authKyInstance = createAuthClient(storage);
    const authHttpClient = new KyHttpClient(authKyInstance);

    // Auth
    const authService = new AuthService(publicHttpClient, authHttpClient, storage);

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

    // User
    const userService = new UserService(authHttpClient);

    return {
      storage,
      logger,
      analytics,
      errorReporter,
      authService,
      friendService,
      todoService,
      todoCategoryService,
      notificationService,
      todoNudgeService,
      userService,
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
export const useLogger = () => useDI().logger;
export const useAnalytics = () => useDI().analytics;
export const useErrorReporter = () => useDI().errorReporter;

// Service Hooks
export const useAuthService = () => useDI().authService;
export const useFriendService = () => useDI().friendService;
export const useTodoService = () => useDI().todoService;
export const useTodoCategoryService = () => useDI().todoCategoryService;
export const useNotificationService = () => useDI().notificationService;
export const useTodoNudgeService = () => useDI().todoNudgeService;
export const useUserService = () => useDI().userService;

import type { Analytics } from '@src/core/ports/analytics';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { Logger } from '@src/core/ports/logger';
import type { Storage } from '@src/core/ports/storage';
import { AchievementService } from '@src/features/achievement/services/achievement.service';
import { AiService } from '@src/features/ai/services/ai.service';
import { AuthService } from '@src/features/auth/services/auth.service';
import { FriendService } from '@src/features/friend/services/friend.service';
import { DeviceIdRepositoryImpl } from '@src/features/notification/repositories/device-id.repository.impl';
import { DeviceIdService } from '@src/features/notification/services/device-id.service';
import { NotificationService } from '@src/features/notification/services/notification.service';
import { PushTokenService } from '@src/features/notification/services/push-token.service';
import { RevenueCatSdkManager } from '@src/features/subscription/services/revenuecat-sdk-manager';
import { SubscriptionService } from '@src/features/subscription/services/subscription.service';
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
  achievementService: AchievementService;
  aiService: AiService;
  authService: AuthService;
  friendService: FriendService;
  todoService: TodoService;
  todoCategoryService: TodoCategoryService;
  notificationService: NotificationService;
  todoNudgeService: TodoNudgeService;
  userService: UserService;
  revenueCatSdkManager: RevenueCatSdkManager;
  subscriptionService: SubscriptionService;
}

const DIContext = createContext<DIContainer | null>(null);

export const DIProvider = ({ children }: PropsWithChildren) => {
  const [di] = useState<DIContainer>(() => {
    const storage = new SecureStorage();

    // Observability
    const consoleLogger = createConsoleLogger({ minLevel: ENV.IS_PRODUCTION ? 'warn' : 'debug' });

    if (ENV.IS_PRODUCTION) {
      initCrashlytics(true, consoleLogger);
    }

    const logger = ENV.IS_PRODUCTION
      ? createCompositeLogger([consoleLogger, createCrashlyticsLogger()])
      : consoleLogger;

    setGlobalLogger(logger);

    const analytics = ENV.IS_PRODUCTION
      ? createFirebaseAnalytics(logger)
      : createConsoleAnalytics();

    const errorReporter = ENV.IS_PRODUCTION
      ? createCrashlyticsErrorReporter(logger)
      : createConsoleErrorReporter();

    const publicKyInstance = createPublicClient();
    const publicHttpClient = new KyHttpClient(publicKyInstance);

    const authKyInstance = createAuthClient(storage);
    const authHttpClient = new KyHttpClient(authKyInstance);

    // Achievement
    const achievementService = new AchievementService(authHttpClient);

    // AI
    const aiService = new AiService(authHttpClient, logger);

    // Auth
    const authService = new AuthService(publicHttpClient, authHttpClient, storage);

    // Friend
    const friendService = new FriendService(authHttpClient);

    // Todo
    const todoService = new TodoService(authHttpClient);

    // Todo Category
    const todoCategoryService = new TodoCategoryService(authHttpClient);

    // Notification
    const deviceIdRepository = new DeviceIdRepositoryImpl();
    const deviceIdService = new DeviceIdService(deviceIdRepository);
    const pushTokenService = new PushTokenService();
    const notificationService = new NotificationService(
      authHttpClient,
      deviceIdService,
      pushTokenService,
      logger,
    );

    // Todo Nudge
    const todoNudgeService = new TodoNudgeService(authHttpClient);

    // User
    const userService = new UserService(authHttpClient);

    // Subscription
    const revenueCatSdkManager = new RevenueCatSdkManager(logger);
    const subscriptionService = new SubscriptionService(revenueCatSdkManager, logger);

    return {
      storage,
      logger,
      analytics,
      errorReporter,
      achievementService,
      aiService,
      authService,
      friendService,
      todoService,
      todoCategoryService,
      notificationService,
      todoNudgeService,
      userService,
      revenueCatSdkManager,
      subscriptionService,
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
export const useAchievementService = () => useDI().achievementService;
export const useAiService = () => useDI().aiService;
export const useAuthService = () => useDI().authService;
export const useFriendService = () => useDI().friendService;
export const useTodoService = () => useDI().todoService;
export const useTodoCategoryService = () => useDI().todoCategoryService;
export const useNotificationService = () => useDI().notificationService;
export const useTodoNudgeService = () => useDI().todoNudgeService;
export const useUserService = () => useDI().userService;
export const useRevenueCatSdkManager = () => useDI().revenueCatSdkManager;
export const useSubscriptionService = () => useDI().subscriptionService;

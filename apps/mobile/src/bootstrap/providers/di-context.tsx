import type { Analytics } from '@src/core/ports/analytics';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { Logger } from '@src/core/ports/logger';
import type { Storage } from '@src/core/ports/storage';
import type { AchievementService } from '@src/features/achievement/services/achievement.service';
import type { AiService } from '@src/features/ai/services/ai.service';
import type { AuthService } from '@src/features/auth/services/auth.service';
import type { FriendService } from '@src/features/friend/services/friend.service';
import type { InquiryService } from '@src/features/inquiry/services/inquiry.service';
import type { MemoService } from '@src/features/memo/services/memo.service';
import type { NotificationService } from '@src/features/notification/services/notification.service';
import type { RevenueCatSdkManager } from '@src/features/subscription/services/revenuecat-sdk-manager';
import type { SubscriptionService } from '@src/features/subscription/services/subscription.service';
import type { SubTodoService } from '@src/features/todo/services/sub-todo.service';
import type { TodoService } from '@src/features/todo/services/todo.service';
import type { TodoCategoryService } from '@src/features/todo/services/todo-category.service';
import type { TodoNudgeService } from '@src/features/todo/services/todo-nudge.service';
import type { UserService } from '@src/features/user/services/user.service';
import type { WeatherService } from '@src/features/weather/services/weather.service';
import type { TokenRefresher } from '@src/shared/infra/http/token-refresher';
import { createContext, type PropsWithChildren, use } from 'react';

export interface DIContainer {
  // Infrastructure
  storage: Storage;
  logger: Logger;
  analytics: Analytics;
  errorReporter: ErrorReporter;
  /** 앱 전체 단일 토큰 리프레셔 — auth-client의 401 훅과 부팅 검증이 공유 (single-flight) */
  tokenRefresher: TokenRefresher;

  // Services
  achievementService: AchievementService;
  aiService: AiService;
  authService: AuthService;
  friendService: FriendService;
  inquiryService: InquiryService;
  memoService: MemoService;
  subTodoService: SubTodoService;
  todoService: TodoService;
  todoCategoryService: TodoCategoryService;
  notificationService: NotificationService;
  todoNudgeService: TodoNudgeService;
  userService: UserService;
  revenueCatSdkManager: RevenueCatSdkManager;
  subscriptionService: SubscriptionService;
  weatherService: WeatherService;
}

export const DIContext = createContext<DIContainer | null>(null);

interface StaticDIProviderProps extends PropsWithChildren {
  container: DIContainer;
}

/**
 * 미리 구성된 컨테이너를 그대로 주입하는 Provider.
 * 구현체 모듈(vendor 초기화 포함)을 로드하지 않으므로 테스트에서 사용한다.
 */
export const StaticDIProvider = ({ container, children }: StaticDIProviderProps) => (
  <DIContext.Provider value={container}>{children}</DIContext.Provider>
);

export const useDI = (): DIContainer => {
  const context = use(DIContext);

  if (!context) {
    throw new Error('useDI must be used within DIProvider');
  }

  return context;
};

// Infrastructure Hooks
export const useStorage = () => useDI().storage;
export const useTokenRefresher = () => useDI().tokenRefresher;
export const useLogger = () => useDI().logger;
export const useAnalytics = () => useDI().analytics;
export const useErrorReporter = () => useDI().errorReporter;

// Service Hooks
export const useAchievementService = () => useDI().achievementService;
export const useAiService = () => useDI().aiService;
export const useAuthService = () => useDI().authService;
export const useFriendService = () => useDI().friendService;
export const useInquiryService = () => useDI().inquiryService;
export const useMemoService = () => useDI().memoService;
export const useSubTodoService = () => useDI().subTodoService;
export const useTodoService = () => useDI().todoService;
export const useTodoCategoryService = () => useDI().todoCategoryService;
export const useNotificationService = () => useDI().notificationService;
export const useTodoNudgeService = () => useDI().todoNudgeService;
export const useUserService = () => useDI().userService;
export const useRevenueCatSdkManager = () => useDI().revenueCatSdkManager;
export const useSubscriptionService = () => useDI().subscriptionService;
export const useWeatherService = () => useDI().weatherService;

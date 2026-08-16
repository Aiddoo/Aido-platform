import type { Analytics } from '@src/core/ports/analytics';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { Logger } from '@src/core/ports/logger';
import type { Storage } from '@src/core/ports/storage';
import type { TokenStore } from '@src/core/ports/token-store';
import type { SessionManager } from '@src/core/session/session-manager';
import type { AchievementService } from '@src/features/achievement/services/achievement.service';
import type { ActivationService } from '@src/features/activation/services/activation.service';
import type { AiService } from '@src/features/ai/services/ai.service';
import type { AuthService } from '@src/features/auth/services/auth.service';
import type { FeatureDiscoveryStateService } from '@src/features/feature-discovery/services/feature-discovery-state.service';
import type { FeatureDiscoveryService } from '@src/features/feature-discovery/services/feature-discovery.service';
import type { FriendService } from '@src/features/friend/services/friend.service';
import type { InquiryService } from '@src/features/inquiry/services/inquiry.service';
import type { MemoService } from '@src/features/memo/services/memo.service';
import type { NotificationService } from '@src/features/notification/services/notification.service';
import type { RevenueCatSdkManager } from '@src/features/subscription/services/revenuecat-sdk-manager';
import type { SubscriptionService } from '@src/features/subscription/services/subscription.service';
import type { TodoCommentService } from '@src/features/todo-comment/services/todo-comment.service';
import type { ReorderCoachmarkService } from '@src/features/todo/services/reorder-coachmark.service';
import type { StoreReviewPromptService } from '@src/features/todo/services/store-review-prompt.service';
import type { SubTodoService } from '@src/features/todo/services/sub-todo.service';
import type { TodoCategoryService } from '@src/features/todo/services/todo-category.service';
import type { TodoNudgeService } from '@src/features/todo/services/todo-nudge.service';
import type { TodoService } from '@src/features/todo/services/todo.service';
import type { UserService } from '@src/features/user/services/user.service';
import type { WeatherService } from '@src/features/weather/services/weather.service';
import type { WidgetSyncService } from '@src/features/widget/services/widget-sync.service';
import type { FeatureAttributionStore } from '@src/shared/analytics/feature-attribution';
import type { TokenRefresher } from '@src/shared/infra/http/token-refresher';
import { createContext, type PropsWithChildren, use } from 'react';

export interface DIContainer {
  // Infrastructure
  storage: Storage;
  logger: Logger;
  analytics: Analytics;
  errorReporter: ErrorReporter;
  /** 토큰 키를 아는 유일한 곳 */
  tokenStore: TokenStore;
  /** 세션 종료(토큰 삭제 + 만료 이벤트)의 유일한 소유자 */
  sessionManager: SessionManager;
  /** 앱 전체 단일 토큰 리프레셔 — auth-client의 401 훅이 공유 (single-flight) */
  tokenRefresher: TokenRefresher;
  featureAttribution: FeatureAttributionStore;

  // Services
  achievementService: AchievementService;
  aiService: AiService;
  authService: AuthService;
  activationService: ActivationService;
  friendService: FriendService;
  featureDiscoveryService: FeatureDiscoveryService;
  featureDiscoveryStateService: FeatureDiscoveryStateService;
  inquiryService: InquiryService;
  memoService: MemoService;
  subTodoService: SubTodoService;
  todoService: TodoService;
  todoCommentService: TodoCommentService;
  todoCategoryService: TodoCategoryService;
  notificationService: NotificationService;
  todoNudgeService: TodoNudgeService;
  reorderCoachmarkService: ReorderCoachmarkService;
  storeReviewPromptService: StoreReviewPromptService;
  userService: UserService;
  revenueCatSdkManager: RevenueCatSdkManager;
  subscriptionService: SubscriptionService;
  weatherService: WeatherService;
  widgetSyncService: WidgetSyncService;
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
export const useTokenStore = () => useDI().tokenStore;
export const useSessionManager = () => useDI().sessionManager;
export const useTokenRefresher = () => useDI().tokenRefresher;
export const useFeatureAttribution = () => useDI().featureAttribution;
export const useLogger = () => useDI().logger;
export const useAnalytics = () => useDI().analytics;
export const useErrorReporter = () => useDI().errorReporter;

// Service Hooks
export const useAchievementService = () => useDI().achievementService;
export const useAiService = () => useDI().aiService;
export const useAuthService = () => useDI().authService;
export const useActivationService = () => useDI().activationService;
export const useFriendService = () => useDI().friendService;
export const useFeatureDiscoveryService = () => useDI().featureDiscoveryService;
export const useFeatureDiscoveryStateService = () => useDI().featureDiscoveryStateService;
export const useInquiryService = () => useDI().inquiryService;
export const useMemoService = () => useDI().memoService;
export const useSubTodoService = () => useDI().subTodoService;
export const useTodoService = () => useDI().todoService;
export const useTodoCommentService = () => useDI().todoCommentService;
export const useTodoCategoryService = () => useDI().todoCategoryService;
export const useNotificationService = () => useDI().notificationService;
export const useTodoNudgeService = () => useDI().todoNudgeService;
export const useReorderCoachmarkService = () => useDI().reorderCoachmarkService;
export const useStoreReviewPromptService = () => useDI().storeReviewPromptService;
export const useUserService = () => useDI().userService;
export const useRevenueCatSdkManager = () => useDI().revenueCatSdkManager;
export const useSubscriptionService = () => useDI().subscriptionService;
export const useWeatherService = () => useDI().weatherService;
export const useWidgetSyncService = () => useDI().widgetSyncService;

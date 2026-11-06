import type { Analytics } from '@src/core/ports/analytics';
import type { ClipboardGateway } from '@src/core/ports/clipboard';
import type { ErrorReporter } from '@src/core/ports/error-reporter';
import type { HapticsGateway } from '@src/core/ports/haptics';
import type { IdGenerator } from '@src/core/ports/id-generator';
import type { LocationGateway } from '@src/core/ports/location-gateway';
import type { Logger } from '@src/core/ports/logger';
import type { NetworkStatusGateway } from '@src/core/ports/network-status';
import type { PurchasesGateway } from '@src/core/ports/purchases';
import type { PushNotificationGateway } from '@src/core/ports/push-notification-gateway';
import type { SpeechRecognizer } from '@src/core/ports/speech-recognizer';
import type { Storage } from '@src/core/ports/storage';
import type { TokenStore } from '@src/core/ports/token-store';
import type { SessionManager } from '@src/core/session/session-manager';
import type { AppVersionService } from '@src/features/app-config/app-version/apis/app-version.service';
import type { WhatsNewStateService } from '@src/features/app-config/whats-new/apis/whats-new-state.service';
import type { WhatsNewService } from '@src/features/app-config/whats-new/apis/whats-new.service';
import type { SuggestionService } from '@src/features/assistant/suggestion/apis/suggestion.service';
import type { EntitlementService } from '@src/features/billing/subscription/apis/entitlement.service';
import type { PurchasesSdkManager } from '@src/features/billing/subscription/apis/purchases-sdk-manager';
import type { SubscriptionService } from '@src/features/billing/subscription/apis/subscription.service';
import type { ActivationService } from '@src/features/device/activation/apis/activation.service';
import type { AppIconService } from '@src/features/device/app-icon/apis/app-icon.service';
import type { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import type { StoreReviewService } from '@src/features/device/store-review/apis/store-review.service';
import type { WidgetNavigationRepository } from '@src/features/device/widget/apis/widget-navigation.repository';
import type { WidgetSyncService } from '@src/features/device/widget/apis/widget-sync.service';
import type { TodoCommentService } from '@src/features/engagement/comment/apis/todo-comment.service';
import type { AuthService } from '@src/features/identity/auth/apis/auth.service';
import type { SessionCleanupService } from '@src/features/identity/auth/apis/session-cleanup.service';
import type { SessionRevocationService } from '@src/features/identity/auth/apis/session-revocation.service';
import type { ConsentService } from '@src/features/identity/consent/apis/consent.service';
import type { PreferenceService } from '@src/features/identity/preference/apis/preference.service';
import type { UserService } from '@src/features/identity/user/apis/user.service';
import type { AchievementService } from '@src/features/insights/achievement/apis/achievement.service';
import type { ReportService } from '@src/features/insights/report/apis/report.service';
import type { MemoService } from '@src/features/notes/memo/apis/memo.service';
import type { DeviceTimezoneService } from '@src/features/notification/apis/device-timezone.service';
import type { MarketingPushPromptService } from '@src/features/notification/apis/marketing-push-prompt.service';
import type { NotificationService } from '@src/features/notification/apis/notification.service';
import type { PushDeviceService } from '@src/features/notification/apis/push-device.service';
import type { PushPromptService } from '@src/features/notification/apis/push-prompt.service';
import type { TodoCategoryService } from '@src/features/planning/category/apis/todo-category.service';
import type { FriendStripHintService } from '@src/features/planning/todo/apis/friend-strip-hint.service';
import type { SubTodoService } from '@src/features/planning/todo/apis/sub-todo.service';
import type { TodoService } from '@src/features/planning/todo/apis/todo.service';
import type { FriendService } from '@src/features/social/friend/apis/friend.service';
import type { InviteShareService } from '@src/features/social/invite/apis/invite-share.service';
import type { InviteService } from '@src/features/social/invite/apis/invite.service';
import type { ModerationService } from '@src/features/social/moderation/apis/moderation.service';
import type { TodoNudgeService } from '@src/features/social/nudge/apis/todo-nudge.service';
import type { InquiryService } from '@src/features/support/inquiry/apis/inquiry.service';
import type { OfflineModelPromptRepository } from '@src/features/voice/apis/offline-model-prompt.repository';
import type { RecognitionLanguageRepository } from '@src/features/voice/apis/recognition-language.repository';
import type { VoiceNoteStorageService } from '@src/features/voice/apis/voice-note-storage.service';
import type { VoiceService } from '@src/features/voice/apis/voice.service';
import type { WeatherIntroductionService } from '@src/features/weather/apis/weather-introduction.service';
import type { WeatherService } from '@src/features/weather/apis/weather.service';
import type { FeatureAttributionStore } from '@src/shared/analytics/feature-attribution';
import type { DraftService } from '@src/shared/draft/draft.service';
import type { TokenRefresher } from '@src/shared/infra/http/token-refresher';
import { createContext, type PropsWithChildren, use } from 'react';

import type { QueryCacheStorage } from './query-cache-persistence';

export interface DIContainer {
  // Infrastructure
  storage: Storage;
  locationGateway: LocationGateway;
  clipboard: ClipboardGateway;
  networkStatus: NetworkStatusGateway;
  logger: Logger;
  analytics: Analytics;
  errorReporter: ErrorReporter;
  haptics: HapticsGateway;
  idGenerator: IdGenerator;
  speechRecognizer: SpeechRecognizer;
  /** 스토어 결제 SDK. 화면은 SubscriptionService로만 쓴다 */
  purchasesGateway: PurchasesGateway;
  pushNotificationGateway: PushNotificationGateway;
  /** 토큰 키를 아는 유일한 곳 */
  tokenStore: TokenStore;
  /** 세션 종료(토큰 삭제 + 만료 이벤트)의 유일한 소유자 */
  sessionManager: SessionManager;
  /** 세션이 끝난 뒤 기기에 남은 계정 데이터를 정리한다 */
  sessionCleanupService: SessionCleanupService;
  /** 오프라인 로그아웃 뒤 온라인이 되면 서버 세션과 푸시 기기를 푼다 */
  sessionRevocationService: SessionRevocationService;
  /** 앱 전체 단일 토큰 리프레셔 — auth-client의 401 훅이 공유 (single-flight) */
  tokenRefresher: TokenRefresher;
  featureAttribution: FeatureAttributionStore;
  /** 작성 중 초안(사용자 범위 로컬 상태) */
  draftService: DraftService;
  /** 오프라인 조회 캐시(사용자 범위 로컬 상태) */
  queryCacheStorage: QueryCacheStorage;
  recognitionLanguageRepository: RecognitionLanguageRepository;
  offlineModelPromptRepository: OfflineModelPromptRepository;

  // Services
  achievementService: AchievementService;
  reportService: ReportService;
  suggestionService: SuggestionService;
  consentService: ConsentService;
  authService: AuthService;
  preferenceService: PreferenceService;
  activationService: ActivationService;
  appVersionService: AppVersionService;
  appIconService: AppIconService;
  friendService: FriendService;
  inviteService: InviteService;
  inviteShareService: InviteShareService;
  whatsNewService: WhatsNewService;
  whatsNewStateService: WhatsNewStateService;
  inquiryService: InquiryService;
  memoService: MemoService;
  voiceService: VoiceService;
  moderationService: ModerationService;
  subTodoService: SubTodoService;
  todoService: TodoService;
  todoCommentService: TodoCommentService;
  todoCategoryService: TodoCategoryService;
  notificationService: NotificationService;
  pushDeviceService: PushDeviceService;
  deviceTimezoneService: DeviceTimezoneService;
  pushPromptService: PushPromptService;
  marketingPushPromptService: MarketingPushPromptService;
  todoNudgeService: TodoNudgeService;
  coachmarkService: CoachmarkService;
  friendStripHintService: FriendStripHintService;
  storeReviewService: StoreReviewService;
  userService: UserService;
  purchasesSdkManager: PurchasesSdkManager;
  subscriptionService: SubscriptionService;
  entitlementService: EntitlementService;
  weatherService: WeatherService;
  weatherIntroductionService: WeatherIntroductionService;
  widgetSyncService: WidgetSyncService;
  widgetNavigationRepository: WidgetNavigationRepository;
  voiceNoteStorageService: VoiceNoteStorageService;
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

const useDI = (): DIContainer => {
  const context = use(DIContext);

  if (!context) {
    throw new Error('useDI must be used within DIProvider');
  }

  return context;
};

// Infrastructure Hooks
export const useLocationGateway = () => useDI().locationGateway;
export const useClipboard = () => useDI().clipboard;
export const useNetworkStatus = () => useDI().networkStatus;
export const useTokenStore = () => useDI().tokenStore;
export const useSessionCleanupService = () => useDI().sessionCleanupService;
export const useSessionRevocationService = () => useDI().sessionRevocationService;
export const useFeatureAttribution = () => useDI().featureAttribution;
export const useLogger = () => useDI().logger;
export const useAnalytics = () => useDI().analytics;
export const useErrorReporter = () => useDI().errorReporter;
export const useHaptics = () => useDI().haptics;
export const useIdGenerator = () => useDI().idGenerator;
export const useSpeechRecognizer = () => useDI().speechRecognizer;
export const usePushNotificationGateway = () => useDI().pushNotificationGateway;
export const useDraftService = () => useDI().draftService;
export const useQueryCacheStorage = () => useDI().queryCacheStorage;
export const useRecognitionLanguageRepository = () => useDI().recognitionLanguageRepository;
export const useOfflineModelPromptRepository = () => useDI().offlineModelPromptRepository;

// Service Hooks
export const useAchievementService = () => useDI().achievementService;
export const useReportService = () => useDI().reportService;
export const useSuggestionService = () => useDI().suggestionService;
export const useConsentService = () => useDI().consentService;
export const useAuthService = () => useDI().authService;
export const usePreferenceService = () => useDI().preferenceService;
export const useActivationService = () => useDI().activationService;
export const useAppVersionService = () => useDI().appVersionService;
export const useFriendService = () => useDI().friendService;
export const useInviteService = () => useDI().inviteService;
export const useInviteShareService = () => useDI().inviteShareService;
export const useWhatsNewService = () => useDI().whatsNewService;
export const useWhatsNewStateService = () => useDI().whatsNewStateService;
export const useInquiryService = () => useDI().inquiryService;
export const useMemoService = () => useDI().memoService;
export const useVoiceService = () => useDI().voiceService;
export const useModerationService = () => useDI().moderationService;
export const useSubTodoService = () => useDI().subTodoService;
export const useTodoService = () => useDI().todoService;
export const useTodoCommentService = () => useDI().todoCommentService;
export const useTodoCategoryService = () => useDI().todoCategoryService;
export const useNotificationService = () => useDI().notificationService;
export const usePushDeviceService = () => useDI().pushDeviceService;
export const useDeviceTimezoneService = () => useDI().deviceTimezoneService;
export const usePushPromptService = () => useDI().pushPromptService;
export const useMarketingPushPromptService = () => useDI().marketingPushPromptService;
export const useTodoNudgeService = () => useDI().todoNudgeService;
export const useCoachmarkService = () => useDI().coachmarkService;
export const useFriendStripHintService = () => useDI().friendStripHintService;
export const useStoreReviewService = () => useDI().storeReviewService;
export const useUserService = () => useDI().userService;
export const usePurchasesSdkManager = () => useDI().purchasesSdkManager;
export const useSubscriptionService = () => useDI().subscriptionService;
export const useEntitlementService = () => useDI().entitlementService;
export const useWeatherIntroductionService = () => useDI().weatherIntroductionService;
export const useWeatherService = () => useDI().weatherService;
export const useWidgetSyncService = () => useDI().widgetSyncService;
export const useWidgetNavigationRepository = () => useDI().widgetNavigationRepository;
export const useVoiceNoteStorageService = () => useDI().voiceNoteStorageService;

export const useAppIconService = () => useDI().appIconService;

import type { AppStoreListingGateway } from '@src/core/ports/app-store-listing-gateway';
import type { IdGenerator } from '@src/core/ports/id-generator';
import type { LocationGateway } from '@src/core/ports/location-gateway';
import type { NativeApplicationMetadataGateway } from '@src/core/ports/native-application-metadata-gateway';
import type { NetworkStatusGateway } from '@src/core/ports/network-status-gateway';
import type { PushNotificationGateway } from '@src/core/ports/push-notification-gateway';
import type { ScreenOrientationGateway } from '@src/core/ports/screen-orientation-gateway';
import type { SocialAuthGateway } from '@src/core/ports/social-auth-gateway';
import type { SpeechRecognizer } from '@src/core/ports/speech-recognizer';
import type { TokenStore } from '@src/core/ports/token-store';
import type { ViewCaptureGateway } from '@src/core/ports/view-capture-gateway';
import type { SessionEpoch } from '@src/core/session/session-epoch';
import type { AppVersionApi } from '@src/features/app-config/app-version/apis/app-version.api';
import type { WhatsNewCampaignApi } from '@src/features/app-config/whats-new/apis/whats-new-campaign.api';
import type { WhatsNewRepository } from '@src/features/app-config/whats-new/repositories/whats-new.repository';
import type { SuggestionApi } from '@src/features/assistant/suggestion/apis/suggestion.api';
import type { EntitlementApi } from '@src/features/billing/subscription/apis/entitlement.api';
import type { PurchasesSession } from '@src/features/billing/subscription/services/purchases.session';
import type { SubscriptionService } from '@src/features/billing/subscription/services/subscription.service';
import type { ActivationProgressRepository } from '@src/features/device/activation/repositories/activation-progress.repository';
import type { ActivationService } from '@src/features/device/activation/services/activation.service';
import type { AppIconService } from '@src/features/device/app-icon/services/app-icon.service';
import type { CoachmarkRepository } from '@src/features/device/coachmark/repositories/coachmark.repository';
import type { StoreReviewService } from '@src/features/device/store-review/services/store-review.service';
import type { WidgetNavigationRepository } from '@src/features/device/widget/repositories/widget-navigation.repository';
import type { WidgetSyncService } from '@src/features/device/widget/services/widget-sync.service';
import type { TodoCommentApi } from '@src/features/engagement/comment/apis/todo-comment.api';
import type { AuthApi } from '@src/features/identity/auth/apis/auth.api';
import type { LogOutDeviceService } from '@src/features/identity/auth/services/log-out-device.service';
import type { SessionCleanupService } from '@src/features/identity/auth/services/session-cleanup.service';
import type { SessionRevocationService } from '@src/features/identity/auth/services/session-revocation.service';
import type { SignInService } from '@src/features/identity/auth/services/sign-in.service';
import type { AuthSessionStore } from '@src/features/identity/auth/stores/auth-session.store';
import type { ConsentApi } from '@src/features/identity/consent/apis/consent.api';
import type { PreferenceApi } from '@src/features/identity/preference/apis/preference.api';
import type { UserApi } from '@src/features/identity/user/apis/user.api';
import type { AchievementApi } from '@src/features/insights/achievement/apis/achievement.api';
import type { ReportApi } from '@src/features/insights/report/apis/report.api';
import type { MemoApi } from '@src/features/notes/memo/apis/memo.api';
import type { NotificationApi } from '@src/features/notification/apis/notification.api';
import type { MarketingPushPromptRepository } from '@src/features/notification/repositories/marketing-push-prompt.repository';
import type { NotificationBadgeService } from '@src/features/notification/services/notification-badge.service';
import type { PushRegistrationService } from '@src/features/notification/services/push-registration.service';
import type { PushNotificationEntryStore } from '@src/features/notification/stores/push-notification-entry.store';
import type { PushOnboardingGuardStore } from '@src/features/notification/stores/push-onboarding-guard.store';
import type { TodoCategoryApi } from '@src/features/planning/category/apis/todo-category.api';
import type { SubTodoApi } from '@src/features/planning/todo/apis/sub-todo.api';
import type { TodoApi } from '@src/features/planning/todo/apis/todo.api';
import type { FriendApi } from '@src/features/social/friend/apis/friend.api';
import type { InviteShareService } from '@src/features/social/invite/services/invite-share.service';
import type { InviteService } from '@src/features/social/invite/services/invite.service';
import type { PendingRedemptionService } from '@src/features/social/invite/services/pending-redemption.service';
import type { ModerationApi } from '@src/features/social/moderation/apis/moderation.api';
import type { TodoNudgeApi } from '@src/features/social/nudge/apis/todo-nudge.api';
import type { InquiryApi } from '@src/features/support/inquiry/apis/inquiry.api';
import type { VoiceApi } from '@src/features/voice/apis/voice.api';
import type { VoiceNoteDraftRepository } from '@src/features/voice/repositories/voice-note-draft.repository';
import type { VoiceRecordingRepository } from '@src/features/voice/repositories/voice-recording.repository';
import type { VoiceNoteStorageService } from '@src/features/voice/services/voice-note-storage.service';
import type { WeatherApi } from '@src/features/weather/apis/weather.api';
import type { WeatherLocationService } from '@src/features/weather/services/weather-location.service';
import { SharedDIContext, type SharedDependencies } from '@src/shared/di/shared-di-context';
import { createContext, type PropsWithChildren, use } from 'react';

import type { QueryCacheStorage } from '../query/query-cache-persistence';

/**
 * 화면이 `use{X}`로 꺼내는 것만 둔다. 조립에만 쓰는 포트는 `AppContainerPorts`에 있다.
 * 순서는 `createAppContainer`의 반환·아래 훅과 같다: 포트, 기능 층 표(1 → 4), 기능마다 빈 줄
 */
export interface DIContainer extends SharedDependencies {
  deviceLocation: LocationGateway;
  applicationMetadata: NativeApplicationMetadataGateway;
  socialAuth: SocialAuthGateway;
  appStoreListing: AppStoreListingGateway;
  networkStatus: NetworkStatusGateway;
  viewCapture: ViewCaptureGateway;
  screenOrientation: ScreenOrientationGateway;
  idGenerator: IdGenerator;
  speechRecognizer: SpeechRecognizer;
  pushNotification: PushNotificationGateway;
  /** 토큰 키를 아는 유일한 곳 */
  tokenStore: TokenStore;
  /** 토큰이 지워질 때마다 올라가는 세션 세대 */
  sessionEpoch: SessionEpoch;
  /** 오프라인 조회 캐시(사용자 범위 로컬 상태) */
  queryCacheStorage: QueryCacheStorage;

  authApi: AuthApi;
  authSessionStore: AuthSessionStore;
  signInService: SignInService;
  /** 세션이 끝난 뒤 기기에 남은 계정 데이터를 정리한다 */
  sessionCleanupService: SessionCleanupService;
  /** 오프라인 로그아웃 뒤 온라인이 되면 서버 세션과 푸시 기기를 푼다 */
  sessionRevocationService: SessionRevocationService;
  logOutDeviceService: LogOutDeviceService;

  consentApi: ConsentApi;

  preferenceApi: PreferenceApi;

  userApi: UserApi;

  entitlementApi: EntitlementApi;
  purchasesSession: PurchasesSession;
  subscriptionService: SubscriptionService;

  inquiryApi: InquiryApi;

  appVersionApi: AppVersionApi;

  appIconService: AppIconService;

  todoApi: TodoApi;
  subTodoApi: SubTodoApi;

  todoCategoryApi: TodoCategoryApi;

  /** 시작·세션 정리만 쓴다. 화면은 저장 값(`coachmarkCompletedAtStoredValue`)을 읽어 훅을 두지 않는다 */
  coachmarkRepository: CoachmarkRepository;

  storeReviewService: StoreReviewService;

  voiceApi: VoiceApi;
  voiceNoteStorageService: VoiceNoteStorageService;
  voiceNoteDraftRepository: VoiceNoteDraftRepository;
  voiceRecordingRepository: VoiceRecordingRepository;

  todoCommentApi: TodoCommentApi;

  friendApi: FriendApi;

  todoNudgeApi: TodoNudgeApi;

  moderationApi: ModerationApi;

  suggestionApi: SuggestionApi;

  achievementApi: AchievementApi;

  reportApi: ReportApi;

  whatsNewCampaignApi: WhatsNewCampaignApi;
  whatsNewRepository: WhatsNewRepository;

  widgetSyncService: WidgetSyncService;
  widgetNavigationRepository: WidgetNavigationRepository;

  memoApi: MemoApi;

  weatherApi: WeatherApi;
  weatherLocationService: WeatherLocationService;

  notificationApi: NotificationApi;
  notificationBadgeService: NotificationBadgeService;
  /** 눌린 푸시 응답 슬롯 */
  pushNotificationEntryStore: PushNotificationEntryStore;
  /** 앱 화면 묶음이 그린 알림 화면 guard 값 */
  pushOnboardingGuardStore: PushOnboardingGuardStore;
  pushRegistrationService: PushRegistrationService;
  marketingPushPromptRepository: MarketingPushPromptRepository;

  inviteService: InviteService;
  pendingRedemptionService: PendingRedemptionService;
  inviteShareService: InviteShareService;

  activationService: ActivationService;
  /** 시작 정리(`useStartupCleanup`)만 쓴다. 화면은 `activationService`를 써서 훅을 두지 않는다 */
  activationProgressRepository: ActivationProgressRepository;
}

const DIContext = createContext<DIContainer | null>(null);

interface StaticDIProviderProps extends PropsWithChildren {
  container: DIContainer;
}

export function StaticDIProvider({ container, children }: StaticDIProviderProps) {
  return (
    <DIContext value={container}>
      <SharedDIContext value={container}>{children}</SharedDIContext>
    </DIContext>
  );
}

export {
  useAnalytics,
  useAppLifecycle,
  useDraftService,
  useErrorReporter,
  useExternalLink,
  useFeatureAttribution,
  useHaptics,
  useIncomingLink,
  useLogger,
  useSystemShare,
} from '@src/shared/di/shared-di-context';

function useDI(): DIContainer {
  const context = use(DIContext);

  if (!context) {
    throw new Error('useDI must be used within DIProvider');
  }

  return context;
}

export function useDeviceLocation() {
  return useDI().deviceLocation;
}
export function useApplicationMetadata() {
  return useDI().applicationMetadata;
}
export function useSocialAuth() {
  return useDI().socialAuth;
}
export function useAppStoreListing() {
  return useDI().appStoreListing;
}
export function useNetworkStatus() {
  return useDI().networkStatus;
}
export function useViewCapture() {
  return useDI().viewCapture;
}
export function useScreenOrientation() {
  return useDI().screenOrientation;
}
export function useIdGenerator() {
  return useDI().idGenerator;
}
export function useSpeechRecognizer() {
  return useDI().speechRecognizer;
}
export function usePushNotification() {
  return useDI().pushNotification;
}
export function useTokenStore() {
  return useDI().tokenStore;
}
export function useSessionEpoch() {
  return useDI().sessionEpoch;
}
export function useQueryCacheStorage() {
  return useDI().queryCacheStorage;
}

export function useAuthApi() {
  return useDI().authApi;
}
export function useAuthSessionStore() {
  return useDI().authSessionStore;
}
export function useSignInService() {
  return useDI().signInService;
}
export function useSessionCleanupService() {
  return useDI().sessionCleanupService;
}
export function useSessionRevocationService() {
  return useDI().sessionRevocationService;
}
export function useLogOutDeviceService() {
  return useDI().logOutDeviceService;
}

export function useConsentApi() {
  return useDI().consentApi;
}

export function usePreferenceApi() {
  return useDI().preferenceApi;
}

export function useUserApi() {
  return useDI().userApi;
}

export function useEntitlementApi() {
  return useDI().entitlementApi;
}
export function usePurchasesSession() {
  return useDI().purchasesSession;
}
export function useSubscriptionService() {
  return useDI().subscriptionService;
}

export function useInquiryApi() {
  return useDI().inquiryApi;
}

export function useAppVersionApi() {
  return useDI().appVersionApi;
}

export function useAppIconService() {
  return useDI().appIconService;
}

export function useTodoApi() {
  return useDI().todoApi;
}
export function useSubTodoApi() {
  return useDI().subTodoApi;
}

export function useTodoCategoryApi() {
  return useDI().todoCategoryApi;
}

export function useStoreReviewService() {
  return useDI().storeReviewService;
}

export function useVoiceApi() {
  return useDI().voiceApi;
}
export function useVoiceNoteStorageService() {
  return useDI().voiceNoteStorageService;
}
export function useVoiceNoteDraftRepository() {
  return useDI().voiceNoteDraftRepository;
}
export function useVoiceRecordingRepository() {
  return useDI().voiceRecordingRepository;
}

export function useTodoCommentApi() {
  return useDI().todoCommentApi;
}

export function useFriendApi() {
  return useDI().friendApi;
}

export function useTodoNudgeApi() {
  return useDI().todoNudgeApi;
}

export function useModerationApi() {
  return useDI().moderationApi;
}

export function useSuggestionApi() {
  return useDI().suggestionApi;
}

export function useAchievementApi() {
  return useDI().achievementApi;
}

export function useReportApi() {
  return useDI().reportApi;
}

export function useWhatsNewCampaignApi() {
  return useDI().whatsNewCampaignApi;
}
export function useWhatsNewRepository() {
  return useDI().whatsNewRepository;
}

export function useWidgetSyncService() {
  return useDI().widgetSyncService;
}
export function useWidgetNavigationRepository() {
  return useDI().widgetNavigationRepository;
}

export function useMemoApi() {
  return useDI().memoApi;
}

export function useWeatherApi() {
  return useDI().weatherApi;
}
export function useWeatherLocationService() {
  return useDI().weatherLocationService;
}

export function useNotificationApi() {
  return useDI().notificationApi;
}
export function useNotificationBadgeService() {
  return useDI().notificationBadgeService;
}
export function usePushNotificationEntryStore() {
  return useDI().pushNotificationEntryStore;
}
export function usePushOnboardingGuardStore() {
  return useDI().pushOnboardingGuardStore;
}
export function usePushRegistrationService() {
  return useDI().pushRegistrationService;
}
export function useMarketingPushPromptRepository() {
  return useDI().marketingPushPromptRepository;
}

export function useInviteService() {
  return useDI().inviteService;
}
export function usePendingRedemptionService() {
  return useDI().pendingRedemptionService;
}
export function useInviteShareService() {
  return useDI().inviteShareService;
}

export function useActivationService() {
  return useDI().activationService;
}

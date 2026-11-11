import type { AppStoreListingGateway } from '@src/core/ports/app-store-listing-gateway';
import type { ClipboardGateway } from '@src/core/ports/clipboard-gateway';
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
import type { AppVersionService } from '@src/features/app-config/app-version/apis/app-version.service';
import type { FeatureCampaignService } from '@src/features/app-config/feature-campaign/apis/feature-campaign.service';
import type { WhatsNewRepository } from '@src/features/app-config/whats-new/apis/whats-new.repository';
import type { SuggestionService } from '@src/features/assistant/suggestion/apis/suggestion.service';
import type { EntitlementService } from '@src/features/billing/subscription/apis/entitlement.service';
import type { PurchasesSession } from '@src/features/billing/subscription/apis/purchases-session';
import type { SubscriptionService } from '@src/features/billing/subscription/apis/subscription.service';
import type { ActivationProgressRepository } from '@src/features/device/activation/apis/activation-progress.repository';
import type { ActivationService } from '@src/features/device/activation/apis/activation.service';
import type { AppIconService } from '@src/features/device/app-icon/apis/app-icon.service';
import type { CoachmarkService } from '@src/features/device/coachmark/apis/coachmark.service';
import type { StoreReviewService } from '@src/features/device/store-review/apis/store-review.service';
import type { WidgetNavigationRepository } from '@src/features/device/widget/apis/widget-navigation.repository';
import type { WidgetSyncService } from '@src/features/device/widget/apis/widget-sync.service';
import type { TodoCommentService } from '@src/features/engagement/comment/apis/todo-comment.service';
import type { AuthSessionStore } from '@src/features/identity/auth/apis/auth-session.store';
import type { AuthService } from '@src/features/identity/auth/apis/auth.service';
import type { LogOutDeviceService } from '@src/features/identity/auth/apis/log-out-device.service';
import type { SessionCleanupService } from '@src/features/identity/auth/apis/session-cleanup.service';
import type { SessionRevocationService } from '@src/features/identity/auth/apis/session-revocation.service';
import type { ConsentService } from '@src/features/identity/consent/apis/consent.service';
import type { PreferenceService } from '@src/features/identity/preference/apis/preference.service';
import type { UserService } from '@src/features/identity/user/apis/user.service';
import type { AchievementService } from '@src/features/insights/achievement/apis/achievement.service';
import type { ReportService } from '@src/features/insights/report/apis/report.service';
import type { MemoService } from '@src/features/notes/memo/apis/memo.service';
import type { MarketingPushPromptRepository } from '@src/features/notification/apis/marketing-push-prompt.repository';
import type { NotificationBadgeService } from '@src/features/notification/apis/notification-badge.service';
import type { NotificationEntryStore } from '@src/features/notification/apis/notification-entry.store';
import type { NotificationService } from '@src/features/notification/apis/notification.service';
import type { PushDeviceService } from '@src/features/notification/apis/push-device.service';
import type { TodoCategoryService } from '@src/features/planning/category/apis/todo-category.service';
import type { SubTodoService } from '@src/features/planning/todo/apis/sub-todo.service';
import type { TodoService } from '@src/features/planning/todo/apis/todo.service';
import type { FriendService } from '@src/features/social/friend/apis/friend.service';
import type { InviteShareService } from '@src/features/social/invite/apis/invite-share.service';
import type { InviteService } from '@src/features/social/invite/apis/invite.service';
import type { PendingRedemptionService } from '@src/features/social/invite/apis/pending-redemption.service';
import type { ModerationService } from '@src/features/social/moderation/apis/moderation.service';
import type { TodoNudgeService } from '@src/features/social/nudge/apis/todo-nudge.service';
import type { InquiryService } from '@src/features/support/inquiry/apis/inquiry.service';
import type { VoiceNoteDraftRepository } from '@src/features/voice/apis/voice-note-draft.repository';
import type { VoiceNoteStorageService } from '@src/features/voice/apis/voice-note-storage.service';
import type { VoiceRecordingRepository } from '@src/features/voice/apis/voice-recording.repository';
import type { VoiceService } from '@src/features/voice/apis/voice.service';
import type { WeatherLocationService } from '@src/features/weather/apis/weather-location.service';
import type { WeatherService } from '@src/features/weather/apis/weather.service';
import { SharedDIContext, type SharedDependencies } from '@src/shared/di/shared-di-context';
import { createContext, type PropsWithChildren, use } from 'react';

import type { QueryCacheStorage } from '../query/query-cache-persistence';

/** 화면이 `use{X}`로 꺼내는 것만 둔다. 조립에만 쓰는 포트는 `AppContainerPorts`에 있다 */
export interface DIContainer extends SharedDependencies {
  deviceLocation: LocationGateway;
  clipboard: ClipboardGateway;
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
  authSessionStore: AuthSessionStore;
  /** 토큰이 지워질 때마다 올라가는 세션 세대 */
  sessionEpoch: SessionEpoch;
  /** 세션이 끝난 뒤 기기에 남은 계정 데이터를 정리한다 */
  sessionCleanupService: SessionCleanupService;
  /** 오프라인 로그아웃 뒤 온라인이 되면 서버 세션과 푸시 기기를 푼다 */
  sessionRevocationService: SessionRevocationService;
  /** 오프라인 조회 캐시(사용자 범위 로컬 상태) */
  queryCacheStorage: QueryCacheStorage;

  achievementService: AchievementService;
  reportService: ReportService;
  suggestionService: SuggestionService;
  consentService: ConsentService;
  authService: AuthService;
  preferenceService: PreferenceService;
  activationService: ActivationService;
  activationProgressRepository: ActivationProgressRepository;
  appVersionService: AppVersionService;
  appIconService: AppIconService;
  friendService: FriendService;
  inviteService: InviteService;
  pendingRedemptionService: PendingRedemptionService;
  inviteShareService: InviteShareService;
  featureCampaignService: FeatureCampaignService;
  whatsNewRepository: WhatsNewRepository;
  inquiryService: InquiryService;
  memoService: MemoService;
  voiceService: VoiceService;
  moderationService: ModerationService;
  subTodoService: SubTodoService;
  todoService: TodoService;
  todoCommentService: TodoCommentService;
  todoCategoryService: TodoCategoryService;
  notificationService: NotificationService;
  notificationBadgeService: NotificationBadgeService;
  /** 눌린 푸시 응답 슬롯 */
  notificationEntryStore: NotificationEntryStore;
  pushDeviceService: PushDeviceService;
  marketingPushPromptRepository: MarketingPushPromptRepository;
  todoNudgeService: TodoNudgeService;
  coachmarkService: CoachmarkService;
  storeReviewService: StoreReviewService;
  userService: UserService;
  purchasesSession: PurchasesSession;
  subscriptionService: SubscriptionService;
  entitlementService: EntitlementService;
  weatherService: WeatherService;
  weatherLocationService: WeatherLocationService;
  widgetSyncService: WidgetSyncService;
  widgetNavigationRepository: WidgetNavigationRepository;
  logOutDeviceService: LogOutDeviceService;
  voiceNoteStorageService: VoiceNoteStorageService;
  voiceNoteDraftRepository: VoiceNoteDraftRepository;
  voiceRecordingRepository: VoiceRecordingRepository;
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
  /** @public */
  useSyncStorage,
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
export function useSocialAuth() {
  return useDI().socialAuth;
}
export function useApplicationMetadata() {
  return useDI().applicationMetadata;
}
export function useAppStoreListing() {
  return useDI().appStoreListing;
}
export function useClipboard() {
  return useDI().clipboard;
}
export function useViewCapture() {
  return useDI().viewCapture;
}
export function useScreenOrientation() {
  return useDI().screenOrientation;
}
export function useNetworkStatus() {
  return useDI().networkStatus;
}
export function useTokenStore() {
  return useDI().tokenStore;
}
export function useAuthSessionStore() {
  return useDI().authSessionStore;
}
export function useSessionEpoch() {
  return useDI().sessionEpoch;
}
export function useSessionCleanupService() {
  return useDI().sessionCleanupService;
}
export function useSessionRevocationService() {
  return useDI().sessionRevocationService;
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
export function useQueryCacheStorage() {
  return useDI().queryCacheStorage;
}

export function useAchievementService() {
  return useDI().achievementService;
}
export function useReportService() {
  return useDI().reportService;
}
export function useSuggestionService() {
  return useDI().suggestionService;
}
export function useConsentService() {
  return useDI().consentService;
}
export function useAuthService() {
  return useDI().authService;
}
export function usePreferenceService() {
  return useDI().preferenceService;
}
export function useActivationService() {
  return useDI().activationService;
}
export function useActivationProgressRepository() {
  return useDI().activationProgressRepository;
}
export function useAppVersionService() {
  return useDI().appVersionService;
}
export function useFriendService() {
  return useDI().friendService;
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
export function useFeatureCampaignService() {
  return useDI().featureCampaignService;
}
export function useWhatsNewRepository() {
  return useDI().whatsNewRepository;
}
export function useInquiryService() {
  return useDI().inquiryService;
}
export function useMemoService() {
  return useDI().memoService;
}
export function useVoiceService() {
  return useDI().voiceService;
}
export function useModerationService() {
  return useDI().moderationService;
}
export function useSubTodoService() {
  return useDI().subTodoService;
}
export function useTodoService() {
  return useDI().todoService;
}
export function useTodoCommentService() {
  return useDI().todoCommentService;
}
export function useTodoCategoryService() {
  return useDI().todoCategoryService;
}
export function useNotificationBadgeService() {
  return useDI().notificationBadgeService;
}
export function useNotificationService() {
  return useDI().notificationService;
}
export function useNotificationEntryStore() {
  return useDI().notificationEntryStore;
}
export function usePushDeviceService() {
  return useDI().pushDeviceService;
}
export function useMarketingPushPromptRepository() {
  return useDI().marketingPushPromptRepository;
}
export function useTodoNudgeService() {
  return useDI().todoNudgeService;
}
export function useCoachmarkService() {
  return useDI().coachmarkService;
}
export function useStoreReviewService() {
  return useDI().storeReviewService;
}
export function useUserService() {
  return useDI().userService;
}
export function usePurchasesSession() {
  return useDI().purchasesSession;
}
export function useSubscriptionService() {
  return useDI().subscriptionService;
}
export function useEntitlementService() {
  return useDI().entitlementService;
}
export function useWeatherLocationService() {
  return useDI().weatherLocationService;
}
export function useWeatherService() {
  return useDI().weatherService;
}
export function useWidgetSyncService() {
  return useDI().widgetSyncService;
}
export function useWidgetNavigationRepository() {
  return useDI().widgetNavigationRepository;
}
export function useLogOutDeviceService() {
  return useDI().logOutDeviceService;
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

export function useAppIconService() {
  return useDI().appIconService;
}

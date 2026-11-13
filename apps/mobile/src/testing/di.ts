import {
  type AppContainerPorts,
  createAppContainer,
} from '@src/bootstrap/providers/create-app-container';
import type { DIContainer } from '@src/bootstrap/providers/di-context';
import { createQueryCacheStorage } from '@src/bootstrap/query/query-cache-persistence';
import type { HttpClient } from '@src/core/ports/http-client';
import type { RefreshTokensRequest } from '@src/core/ports/token-refresher';
import { createSessionEpoch, withSessionEpoch } from '@src/core/session/session-epoch';
import { createInviteLinkOpenedStore } from '@src/features/social/invite/stores/invite-link-opened.store';
import type { QueryClient } from '@tanstack/react-query';

import { createLocalFileSystemFake } from './fakes/local-file-system.fake';
import { createMemoryDeviceIdStore } from './fakes/memory-device-id-store.fake';
import { createMemoryKeyValueStorage } from './fakes/memory-key-value-storage.fake';
import { createMemoryObservableSyncStorage } from './fakes/memory-observable-sync-storage.fake';
import { createMemorySyncStorage } from './fakes/memory-sync-storage.fake';
import { createMemoryTokenStore } from './fakes/memory-token-store.fake';
import { mockMethod } from './mock-method';
import { createAnalyticsStub } from './ports/analytics.stub';
import { createAppIconGatewayStub } from './ports/app-icon-gateway.stub';
import { createAppLifecycleGatewayStub } from './ports/app-lifecycle-gateway.stub';
import { createAppLoggerStub } from './ports/app-logger.stub';
import {
  createAppStoreListingGatewayStub,
  createAppStoreReviewGatewayStub,
} from './ports/app-store-gateway.stub';
import { createClipboardGatewayStub } from './ports/clipboard-gateway.stub';
import {
  createInstallReferrerGatewayStub,
  createInstallationIdGatewayStub,
  createVendorIdGatewayStub,
} from './ports/device-identity-gateway.stub';
import { createErrorReporterStub } from './ports/error-reporter.stub';
import {
  createExternalLinkGatewayStub,
  createIncomingLinkGatewayStub,
} from './ports/external-link-gateway.stub';
import { createHapticsGatewayStub } from './ports/haptics-gateway.stub';
import { createHttpClientStub } from './ports/http-client.stub';
import { createIdGeneratorStub } from './ports/id-generator.stub';
import { createJsonFetcherStub } from './ports/json-fetcher.stub';
import { createLocationGatewayStub } from './ports/location-gateway.stub';
import { createNativeApplicationMetadataGatewayStub } from './ports/native-application-metadata-gateway.stub';
import { createNetworkStatusGatewayStub } from './ports/network-status-gateway.stub';
import { createPurchasesGatewayStub } from './ports/purchases-gateway.stub';
import { createPushNotificationGatewayStub } from './ports/push-notification-gateway.stub';
import { createScreenOrientationGatewayStub } from './ports/screen-orientation-gateway.stub';
import { createSocialAuthGatewayStub } from './ports/social-auth-gateway.stub';
import { createSocialShareGatewayStub } from './ports/social-share-gateway.stub';
import { createSpeechRecognizerStub } from './ports/speech-recognizer.stub';
import { createSystemShareGatewayStub } from './ports/system-share-gateway.stub';
import { createViewCaptureGatewayStub } from './ports/view-capture-gateway.stub';
import { createWidgetBridgeStub } from './ports/widget-bridge.stub';
import { createTestQueryClient } from './query-client';

export interface TestPortOverrides extends Partial<AppContainerPorts> {
  /** 공개 API와 인증 API가 함께 쓰는 HTTP stub. 둘을 나눠 보려면 `publicHttpClient`·`authHttpClient`를 넣는다 */
  httpClient?: HttpClient;
}

/** 포트로 만들지 않는 메모리 상태 store. 테스트가 상태를 미리 정한 것으로 바꾼다 */
type TestDiSeeds = Partial<
  Pick<
    DIContainer,
    | 'authSessionStore'
    | 'pushNotificationEntryStore'
    | 'pushOnboardingGuardStore'
    | 'myPagePaneLayoutStore'
    | 'myPageDetailRootStore'
  >
>;

interface TestDiOptions {
  /** 이 테스트가 바꾸는 포트. 그 포트를 쓰는 Service가 모두 운영처럼 다시 조립된다 */
  ports?: TestPortOverrides;
  seeds?: TestDiSeeds;
}

/** 운영과 같은 조립에 화면 Provider가 쓸 QueryClient(`ports.queryClient`)를 붙인 것 */
export interface TestDi extends DIContainer {
  queryClient: QueryClient;
}

/**
 * `AppContainerPorts`의 stub 기본값. 기본은 정상 기기와 빈 데이터(암호화 저장소를 연 실행)이고, 호출마다 새로 만들어
 * 테스트끼리 상태를 나누지 않는다. 앱 Provider 트리를 올리는 테스트는 `createCompositionRoot`에, 화면 테스트는 `createTestDi`를 거쳐 쓴다
 */
export function createTestPorts({
  httpClient = createHttpClientStub(),
  publicHttpClient = httpClient,
  authHttpClient = httpClient,
  sessionEpoch = createSessionEpoch(),
  tokenStore = createMemoryTokenStore(),
  logger = createAppLoggerStub(),
  analytics = createAnalyticsStub(),
  errorReporter = createErrorReporterStub(),
  haptics = createHapticsGatewayStub(),
  idGenerator = createIdGeneratorStub(),
  speechRecognizer = createSpeechRecognizerStub(),
  purchases = createPurchasesGatewayStub(),
  pushNotification = createPushNotificationGatewayStub(),
  storage = createMemoryKeyValueStorage(),
  jsonFetcher = createJsonFetcherStub(),
  requestRefresh = mockMethod<RefreshTokensRequest>(async () => {
    throw new Error('createTestPorts: requestRefresh를 정하지 않았습니다');
  }),
  socialAuth = createSocialAuthGatewayStub(),
  socialShare = createSocialShareGatewayStub(),
  systemShare = createSystemShareGatewayStub(),
  clipboard = createClipboardGatewayStub(),
  externalLink = createExternalLinkGatewayStub(),
  incomingLink = createIncomingLinkGatewayStub(),
  appLifecycle = createAppLifecycleGatewayStub(),
  networkStatus = createNetworkStatusGatewayStub(),
  viewCapture = createViewCaptureGatewayStub(),
  screenOrientation = createScreenOrientationGatewayStub(),
  deviceLocation = createLocationGatewayStub(),
  applicationMetadata = createNativeApplicationMetadataGatewayStub(),
  appStoreListing = createAppStoreListingGatewayStub(),
  appStoreReview = createAppStoreReviewGatewayStub(),
  appIcon = createAppIconGatewayStub(),
  installReferrer = createInstallReferrerGatewayStub(),
  installationId = createInstallationIdGatewayStub(),
  vendorId = createVendorIdGatewayStub(),
  deviceIdStore = createMemoryDeviceIdStore(),
  localFileSystem = createLocalFileSystemFake(),
  widgetBridge = createWidgetBridgeStub(),
  widgetStorage = createMemoryObservableSyncStorage(),
  syncStorage = createMemoryObservableSyncStorage(),
  draftStorage = createMemorySyncStorage(),
  queryCacheStorage = createQueryCacheStorage(createMemorySyncStorage()),
  queryClient = createTestQueryClient(),
  platform = 'ios',
  deviceModel = null,
  getTimeZone = () => 'Asia/Seoul',
  getLanguage = () => 'ko',
  inviteLinkOpenedStore = createInviteLinkOpenedStore(),
}: TestPortOverrides = {}): AppContainerPorts {
  return {
    publicHttpClient,
    authHttpClient,
    sessionEpoch,
    // 넣은 토큰 저장소도 운영처럼 지울 때 세션 세대를 올린다
    tokenStore: withSessionEpoch(tokenStore, sessionEpoch),
    logger,
    analytics,
    errorReporter,
    haptics,
    idGenerator,
    speechRecognizer,
    purchases,
    pushNotification,
    storage,
    jsonFetcher,
    requestRefresh,
    socialAuth,
    socialShare,
    systemShare,
    clipboard,
    externalLink,
    incomingLink,
    appLifecycle,
    networkStatus,
    viewCapture,
    screenOrientation,
    deviceLocation,
    applicationMetadata,
    appStoreListing,
    appStoreReview,
    appIcon,
    installReferrer,
    installationId,
    vendorId,
    deviceIdStore,
    localFileSystem,
    widgetBridge,
    widgetStorage,
    syncStorage,
    draftStorage,
    queryCacheStorage,
    queryClient,
    platform,
    deviceModel,
    getTimeZone,
    getLanguage,
    inviteLinkOpenedStore,
  };
}

/**
 * stub 포트로 운영과 같은 `createAppContainer`를 부른 DI. `renderScreen`·`renderAppRoute`의 `di`나 `StaticDIProvider`에 넘긴다.
 * - Service·Api·저장소는 넣지 않는다. 포트를 넣으면 그 포트를 쓰는 Service가 모두 다시 조립돼 운영과 같은 그래프다.
 * - 저장 값은 운영처럼 `syncStorage`·`draftStorage`에 넣거나, 만든 DI의 저장소·Service로 미리 쓴다(`di.draftService.save`).
 */
export function createTestDi({ ports: overrides, seeds }: TestDiOptions = {}): TestDi {
  const ports = createTestPorts(overrides);

  return { ...createAppContainer(ports), ...seeds, queryClient: ports.queryClient };
}

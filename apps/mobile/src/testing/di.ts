import {
  type AppContainerPorts,
  createAppContainer,
} from '@src/bootstrap/providers/create-app-container';
import type { DIContainer } from '@src/bootstrap/providers/di-context';
import { createQueryCacheStorage } from '@src/bootstrap/query/query-cache-persistence';
import type { HttpClient } from '@src/core/ports/http-client';
import { createSessionEpoch, withSessionEpoch } from '@src/core/session/session-epoch';

import { createLocalFileSystemFake } from './fakes/local-file-system.fake';
import { createMemoryDeviceIdStore } from './fakes/memory-device-id-store.fake';
import { createMemoryObservableSyncStorage } from './fakes/memory-observable-sync-storage.fake';
import { createMemoryStorage } from './fakes/memory-storage.fake';
import { createMemorySyncStorage } from './fakes/memory-sync-storage.fake';
import { createMemoryTokenStore } from './fakes/memory-token-store.fake';
import { createAnalyticsStub } from './ports/analytics.stub';
import { createAppIconGatewayStub } from './ports/app-icon-gateway.stub';
import { createAppLifecycleGatewayStub } from './ports/app-lifecycle-gateway.stub';
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
import { createLoggerStub } from './ports/logger.stub';
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
import { createTestQueryClient } from './query-client';

interface TestPortOverrides extends Partial<AppContainerPorts> {
  /** 공개 API와 인증 API가 함께 쓰는 HTTP stub. 둘을 나눠 보려면 `publicHttpClient`·`authHttpClient`를 넣는다 */
  httpClient?: HttpClient;
}

export type TestDiOverrides = Partial<DIContainer> & TestPortOverrides;

/**
 * `AppContainerPorts`의 stub 기본값. 기본은 정상 기기와 빈 데이터이고, 호출마다 새로 만들어 테스트끼리 상태를 나누지 않는다.
 * 앱 Provider 트리를 올리는 테스트는 `createCompositionRoot`에, 화면 테스트는 `createTestDi`를 거쳐 쓴다
 */
export function createTestPorts({
  httpClient = createHttpClientStub(),
  publicHttpClient = httpClient,
  authHttpClient = httpClient,
  sessionEpoch = createSessionEpoch(),
  tokenStore = withSessionEpoch(createMemoryTokenStore(), sessionEpoch),
  logger = createLoggerStub(),
  analytics = createAnalyticsStub(),
  errorReporter = createErrorReporterStub(),
  haptics = createHapticsGatewayStub(),
  idGenerator = createIdGeneratorStub(),
  speechRecognizer = createSpeechRecognizerStub(),
  purchases = createPurchasesGatewayStub(),
  pushNotification = createPushNotificationGatewayStub(),
  storage = createMemoryStorage(),
  jsonFetcher = createJsonFetcherStub(),
  requestRefresh = jest.fn(async () => {
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
  widgetBridge = { writeSnapshot: jest.fn(async () => {}) },
  widgetStorage = createMemoryObservableSyncStorage(),
  syncStorage = createMemoryObservableSyncStorage(),
  draftStorage = createMemorySyncStorage(),
  queryCacheStorage = createQueryCacheStorage(createMemorySyncStorage()),
  queryClient = createTestQueryClient(),
  platform = 'ios',
  deviceModel = null,
  getTimeZone = () => 'Asia/Seoul',
  getLanguage = () => 'ko',
}: TestPortOverrides = {}): AppContainerPorts {
  return {
    publicHttpClient,
    authHttpClient,
    sessionEpoch,
    tokenStore,
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
  };
}

/**
 * stub 포트로 운영과 같은 `createAppContainer`를 부른 DI. `renderScreen`의 `di`나 `StaticDIProvider`에 넘긴다.
 * - 포트를 넣으면 그 포트를 쓰는 Service가 모두 다시 조립된다. `logger`를 넣으면 Service도 그 logger를 쓴다.
 * - Service·저장소를 넣으면 그 키만 바뀌고, 그것을 쓰는 다른 Service는 조립한 원래 것을 쓴다.
 * - 저장소는 운영처럼 `syncStorage` 하나를 함께 쓴다. 값을 미리 넣으려면 `di.syncStorage.set`을 쓴다.
 */
export function createTestDi({
  httpClient,
  publicHttpClient,
  authHttpClient,
  purchases,
  storage,
  jsonFetcher,
  requestRefresh,
  socialShare,
  appStoreReview,
  appIcon,
  installReferrer,
  installationId,
  vendorId,
  deviceIdStore,
  localFileSystem,
  widgetBridge,
  widgetStorage,
  draftStorage,
  queryClient,
  platform,
  deviceModel,
  getTimeZone,
  getLanguage,
  ...overrides
}: TestDiOverrides = {}): DIContainer {
  const ports = createTestPorts({
    httpClient,
    publicHttpClient,
    authHttpClient,
    purchases,
    storage,
    jsonFetcher,
    requestRefresh,
    socialShare,
    appStoreReview,
    appIcon,
    installReferrer,
    installationId,
    vendorId,
    deviceIdStore,
    localFileSystem,
    widgetBridge,
    widgetStorage,
    draftStorage,
    queryClient,
    platform,
    deviceModel,
    getTimeZone,
    getLanguage,
    ...overrides,
  });

  return { ...createAppContainer(ports), ...overrides };
}

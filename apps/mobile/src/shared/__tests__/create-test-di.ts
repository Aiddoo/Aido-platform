import {
  type AppContainerPorts,
  createAppContainer,
} from '@src/bootstrap/providers/create-app-container';
import type { DIContainer } from '@src/bootstrap/providers/di-context';
import type { HttpClient } from '@src/core/ports/http-client';
import { createSessionEpoch, withSessionEpoch } from '@src/core/session/session-epoch';

import { createAnalyticsStub } from './create-analytics-stub';
import { createAppIconGatewayStub } from './create-app-icon-gateway-stub';
import { createAppLifecycleGatewayStub } from './create-app-lifecycle-gateway-stub';
import {
  createAppStoreListingGatewayStub,
  createAppStoreReviewGatewayStub,
} from './create-app-store-gateway-stub';
import { createClipboardGatewayStub } from './create-clipboard-gateway-stub';
import {
  createInstallReferrerGatewayStub,
  createInstallationIdGatewayStub,
  createVendorIdGatewayStub,
} from './create-device-identity-gateway-stub';
import { createErrorReporterStub } from './create-error-reporter-stub';
import {
  createExternalLinkGatewayStub,
  createIncomingLinkGatewayStub,
} from './create-external-link-gateway-stub';
import { createHapticsGatewayStub } from './create-haptics-gateway-stub';
import { createHttpClientStub } from './create-http-client-stub';
import { createIdGeneratorStub } from './create-id-generator-stub';
import { createJsonFetcherStub } from './create-json-fetcher-stub';
import { createLocalFileSystemFake } from './create-local-file-system-fake';
import { createLocationGatewayStub } from './create-location-gateway-stub';
import { createLoggerStub } from './create-logger-stub';
import { createMemoryDeviceIdStore } from './create-memory-device-id-store';
import { createMemoryObservableSyncStorage } from './create-memory-observable-sync-storage';
import { createMemoryStorage } from './create-memory-storage';
import { createMemorySyncStorage } from './create-memory-sync-storage';
import { createMemoryTokenStore } from './create-memory-token-store';
import { createNativeApplicationMetadataGatewayStub } from './create-native-application-metadata-gateway-stub';
import { createNetworkStatusGatewayStub } from './create-network-status-gateway-stub';
import { createPurchasesGatewayStub } from './create-purchases-gateway-stub';
import { createPushNotificationGatewayStub } from './create-push-notification-gateway-stub';
import { createScreenOrientationGatewayStub } from './create-screen-orientation-gateway-stub';
import { createSocialAuthGatewayStub } from './create-social-auth-gateway-stub';
import { createSocialShareGatewayStub } from './create-social-share-gateway-stub';
import { createSpeechRecognizerStub } from './create-speech-recognizer-stub';
import { createSystemShareGatewayStub } from './create-system-share-gateway-stub';
import { createViewCaptureGatewayStub } from './create-view-capture-gateway-stub';
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
  purchasesGateway = createPurchasesGatewayStub(),
  pushNotification = createPushNotificationGatewayStub(),
  storage = createMemoryStorage(),
  jsonFetcher = createJsonFetcherStub(),
  requestRefresh = jest.fn(async () => {
    throw new Error('createTestPorts: requestRefresh를 정하지 않았습니다');
  }),
  socialAuth = createSocialAuthGatewayStub(),
  socialShareGateway = createSocialShareGatewayStub(),
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
  appStoreReviewGateway = createAppStoreReviewGatewayStub(),
  appIconGateway = createAppIconGatewayStub(),
  installReferrerGateway = createInstallReferrerGatewayStub(),
  installationIdGateway = createInstallationIdGatewayStub(),
  vendorIdGateway = createVendorIdGatewayStub(),
  deviceIdStore = createMemoryDeviceIdStore(),
  localFileSystem = createLocalFileSystemFake(),
  widgetBridge = { writeSnapshot: jest.fn(async () => {}) },
  widgetStorage = createMemoryObservableSyncStorage(),
  syncStorage = createMemoryObservableSyncStorage(),
  draftStorage = createMemorySyncStorage(),
  queryCacheStorage = null,
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
    purchasesGateway,
    pushNotification,
    storage,
    jsonFetcher,
    requestRefresh,
    socialAuth,
    socialShareGateway,
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
    appStoreReviewGateway,
    appIconGateway,
    installReferrerGateway,
    installationIdGateway,
    vendorIdGateway,
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
 * stub 포트로 운영과 같은 `createAppContainer`를 부른 DI. `renderUi`의 `di`나 `StaticDIProvider`에 넘긴다.
 * - 포트를 넣으면 그 포트를 쓰는 Service가 모두 다시 조립된다. `logger`를 넣으면 Service도 그 logger를 쓴다.
 * - Service·저장소를 넣으면 그 키만 바뀌고, 그것을 쓰는 다른 Service는 조립한 원래 것을 쓴다.
 * - 저장소는 운영처럼 `syncStorage` 하나를 함께 쓴다. 값을 미리 넣으려면 `di.syncStorage.set`을 쓴다.
 */
export function createTestDi({
  httpClient,
  publicHttpClient,
  authHttpClient,
  purchasesGateway,
  storage,
  jsonFetcher,
  requestRefresh,
  socialShareGateway,
  appStoreReviewGateway,
  appIconGateway,
  installReferrerGateway,
  installationIdGateway,
  vendorIdGateway,
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
    purchasesGateway,
    storage,
    jsonFetcher,
    requestRefresh,
    socialShareGateway,
    appStoreReviewGateway,
    appIconGateway,
    installReferrerGateway,
    installationIdGateway,
    vendorIdGateway,
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

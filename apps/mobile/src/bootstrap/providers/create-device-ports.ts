import { createSessionEpoch, withSessionEpoch } from '@src/core/session/session-epoch';
import { createSessionManager } from '@src/core/session/session-manager';
import { createWidgetBridge } from '@src/features/device/widget/bridge/create-widget-bridge';
import { ENV } from '@src/shared/config/env';
import { i18n } from '@src/shared/i18n';
import { expoAppIconGateway } from '@src/shared/infra/app-icon/expo-app-icon-gateway';
import { reactNativeAppLifecycleGateway } from '@src/shared/infra/app-lifecycle/react-native-app-lifecycle-gateway';
import { expoAppStoreListingGateway } from '@src/shared/infra/app-store/expo-app-store-listing-gateway';
import { expoAppStoreReviewGateway } from '@src/shared/infra/app-store/expo-app-store-review-gateway';
import { expoInstallReferrerGateway } from '@src/shared/infra/application/expo-install-referrer-gateway';
import { expoInstallationIdGateway } from '@src/shared/infra/application/expo-installation-id-gateway';
import { expoNativeApplicationMetadataGateway } from '@src/shared/infra/application/expo-native-application-metadata-gateway';
import { expoVendorIdGateway } from '@src/shared/infra/application/expo-vendor-id-gateway';
import { expoClipboardGateway } from '@src/shared/infra/clipboard/expo-clipboard-gateway';
import { DEVICE_MODEL_NAME } from '@src/shared/infra/device/device-info';
import { createEnvironmentErrorReporter } from '@src/shared/infra/error-reporter/create-environment-error-reporter';
import { expoLocalFileSystem } from '@src/shared/infra/file-system/expo-local-file-system';
import { expoHapticsGateway } from '@src/shared/infra/haptics/expo-haptics-gateway';
import { createAuthClient } from '@src/shared/infra/http/auth-client';
import { KyHttpClient } from '@src/shared/infra/http/ky-client';
import { KyJsonFetcher } from '@src/shared/infra/http/ky-json-fetcher';
import { createPublicClient } from '@src/shared/infra/http/public-client';
import { createRefreshTokensRequest } from '@src/shared/infra/http/refresh-tokens-request';
import { createTokenRefresher } from '@src/shared/infra/http/token-refresher';
import { expoIdGenerator } from '@src/shared/infra/id-generator/expo-id-generator';
import { createKakaoSocialShareGateway } from '@src/shared/infra/kakao/kakao-social-share-gateway';
import { expoExternalLinkGateway } from '@src/shared/infra/linking/expo-external-link-gateway';
import { expoIncomingLinkGateway } from '@src/shared/infra/linking/expo-incoming-link-gateway';
import { getDeviceTimezone } from '@src/shared/infra/localization/device-timezone';
import { expoLocationGateway } from '@src/shared/infra/location/expo-location-gateway';
import {
  createCompositeLogger,
  createConsoleLogger,
  createSentryLogger,
} from '@src/shared/infra/logger';
import { createExpoNetworkStatusGateway } from '@src/shared/infra/network/expo-network-status-gateway';
import { createExpoPushNotificationGateway } from '@src/shared/infra/notification/expo-push-notification-gateway';
import { createEnvironmentAnalytics } from '@src/shared/infra/observability/observability-env';
import { createRevenueCatPurchasesGateway } from '@src/shared/infra/purchases/revenuecat-purchases-gateway';
import { expoScreenOrientationGateway } from '@src/shared/infra/screen-orientation/expo-screen-orientation-gateway';
import { expoSystemShareGateway } from '@src/shared/infra/share/expo-system-share-gateway';
import { expoSocialAuthGateway } from '@src/shared/infra/social-auth/expo-social-auth-gateway';
import { expoSpeechRecognizer } from '@src/shared/infra/speech/expo-speech-recognizer';
import { deviceSyncStorage } from '@src/shared/infra/storage/device-sync-storage';
import { secureDeviceIdStore } from '@src/shared/infra/storage/secure-device-id-store';
import { SecureStorage } from '@src/shared/infra/storage/secure-storage';
import { createSecureTokenStore } from '@src/shared/infra/storage/secure-token-store';
import { widgetStorage } from '@src/shared/infra/storage/widget-storage';
import { viewShotViewCaptureGateway } from '@src/shared/infra/view-capture/view-shot-view-capture-gateway';

import type { AppContainerPorts } from './create-app-container';

/** 앱을 연 뒤에 정하는 저장소와 QueryClient를 뺀 기기 포트 */
export type DevicePorts = Omit<
  AppContainerPorts,
  'draftStorage' | 'queryCacheStorage' | 'queryClient'
>;

/** 기기 어댑터를 만든다. 토큰 갱신기·결제 SDK처럼 하나여야 하는 것이 있어 프로세스에 한 번만 부른다 */
export function createDevicePorts(): DevicePorts {
  const storage = new SecureStorage();
  const sessionEpoch = createSessionEpoch();
  const tokenStore = withSessionEpoch(createSecureTokenStore(storage), sessionEpoch);

  // 크래시·오류·로그는 Sentry, Firebase는 제품 지표만. Sentry init은 앱 루트(initErrorReporting)에서 한 번
  const consoleLogger = createConsoleLogger({ minLevel: ENV.IS_PRODUCTION ? 'warn' : 'debug' });
  const logger = ENV.IS_PRODUCTION
    ? createCompositeLogger([consoleLogger, createSentryLogger()])
    : consoleLogger;
  const errorReporter = createEnvironmentErrorReporter();

  const installation = expoNativeApplicationMetadataGateway.getInstallation();
  const appVersion = installation?.currentVersion ?? ENV.APP_VERSION ?? null;
  const appBuild = installation?.currentBuild ?? null;
  const publicKyInstance = createPublicClient({ appVersion, appBuild, errorReporter });

  const sessionManager = createSessionManager(tokenStore);
  // 갱신기가 갈라지면 single-flight가 나뉘어 동시 회전이 서버의 토큰 패밀리를 소모한다
  const requestRefresh = createRefreshTokensRequest({ appVersion, appBuild });
  const tokenRefresher = createTokenRefresher({
    tokenStore,
    requestRefresh,
    sessionEpoch,
    logger,
  });
  const authKyInstance = createAuthClient({
    appVersion,
    appBuild,
    tokenStore,
    refresh: tokenRefresher,
    endSession: (reason) => sessionManager.end(reason),
    sessionEpoch,
    logger,
    errorReporter,
  });

  return {
    logger,
    analytics: createEnvironmentAnalytics(logger),
    errorReporter,
    haptics: expoHapticsGateway,
    idGenerator: expoIdGenerator,
    speechRecognizer: expoSpeechRecognizer,
    purchases: createRevenueCatPurchasesGateway({ isLogEnabled: __DEV__, logger }),
    pushNotification: createExpoPushNotificationGateway(logger),
    storage,
    tokenStore,
    sessionEpoch,
    publicHttpClient: new KyHttpClient(publicKyInstance),
    authHttpClient: new KyHttpClient(authKyInstance),
    jsonFetcher: new KyJsonFetcher(publicKyInstance),
    requestRefresh,
    socialAuth: expoSocialAuthGateway,
    socialShare: createKakaoSocialShareGateway(ENV.KAKAO_NATIVE_APP_KEY),
    systemShare: expoSystemShareGateway,
    clipboard: expoClipboardGateway,
    externalLink: expoExternalLinkGateway,
    incomingLink: expoIncomingLinkGateway,
    appLifecycle: reactNativeAppLifecycleGateway,
    networkStatus: createExpoNetworkStatusGateway(logger),
    viewCapture: viewShotViewCaptureGateway,
    screenOrientation: expoScreenOrientationGateway,
    deviceLocation: expoLocationGateway,
    applicationMetadata: expoNativeApplicationMetadataGateway,
    appStoreListing: expoAppStoreListingGateway,
    appStoreReview: expoAppStoreReviewGateway,
    appIcon: expoAppIconGateway,
    installReferrer: expoInstallReferrerGateway,
    installationId: expoInstallationIdGateway,
    vendorId: expoVendorIdGateway,
    deviceIdStore: secureDeviceIdStore,
    localFileSystem: expoLocalFileSystem,
    widgetBridge: createWidgetBridge(),
    widgetStorage,
    syncStorage: deviceSyncStorage,
    platform: process.env.EXPO_OS === 'ios' ? 'ios' : 'android',
    deviceModel: DEVICE_MODEL_NAME,
    getTimeZone: getDeviceTimezone,
    // 요청 헤더(Accept-Language)와 같은 값이다
    getLanguage: () => i18n.language,
  };
}

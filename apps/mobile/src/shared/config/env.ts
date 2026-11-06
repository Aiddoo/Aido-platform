import { logger } from '@src/shared/infra/logger/global-logger';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { ENV_LOG_EVENT } from './env-log-events';
import { resolveRevenueCatApiKey } from './revenuecat-api-key';

// =============================================================================
// Schema Definitions
// =============================================================================

const AppEnvSchema = z.enum(['development', 'preview', 'production']);
export type AppEnv = z.infer<typeof AppEnvSchema>;

const ExtraSchema = z.object({
  env: AppEnvSchema,
  apiUrl: z.string(),
  devMachineIp: z.string().optional(),
  isDevelopment: z.boolean(),
  isProduction: z.boolean(),
  revenueCatAppleApiKey: z.string().optional(),
  revenueCatGoogleApiKey: z.string().optional(),
  revenueCatTestApiKey: z.string().optional(),
  sentryDsn: z.string().optional(),
  sentryDebug: z.boolean().optional(),
  // .env의 빈 값(EXPO_PUBLIC_KAKAO_NATIVE_APP_KEY=)은 키가 없는 빌드로 본다
  kakaoNativeAppKey: z
    .string()
    .trim()
    .optional()
    .transform((key) => (key == null || key.length === 0 ? undefined : key)),
});

// =============================================================================
// Types
// =============================================================================

type PlatformType = typeof process.env.EXPO_OS;

type ApiUrlContext = {
  platform: PlatformType;
  env: AppEnv;
  apiUrl: string;
  isPhysicalDevice: boolean;
  devMachineIp?: string;
};

// =============================================================================
// Environment Resolution
// =============================================================================

const extra = ExtraSchema.parse(Constants.expoConfig?.extra);

/** 카카오톡 공유 버튼이 앱을 여는 스킴(kakao{네이티브 앱 키}). 키가 없는 빌드는 null */
const resolveKakaoScheme = (kakaoNativeAppKey: string | undefined) =>
  kakaoNativeAppKey == null ? null : `kakao${kakaoNativeAppKey}`;

/**
 * Expo Metro 번들러의 hostUri에서 개발 머신 IP를 자동으로 추출
 * 예: "192.168.1.100:8081" → "192.168.1.100"
 */
const getAutoDetectedDevMachineIp = (): string | undefined => {
  if (!__DEV__) {
    return undefined;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) {
    return undefined;
  }

  const [ip] = hostUri.split(':');
  return ip;
};

const toAndroidEmulatorUrl = (url: string): string => url.replace('localhost', '10.0.2.2');

const toDeviceUrl = (url: string, devMachineIp?: string): string => {
  // 1. 환경변수로 설정된 IP 우선 사용
  // 2. 없으면 자동 감지된 IP 사용
  const autoIp = getAutoDetectedDevMachineIp();
  const resolvedIp = devMachineIp || autoIp;

  if (!resolvedIp) {
    logger.warn(ENV_LOG_EVENT.DEV_MACHINE_IP_MISSING, {
      hint:
        '실제 기기에서 개발 서버에 연결할 수 없습니다. 개발 머신과 기기를 같은 Wi-Fi에 연결하거나 ' +
        '.env.local에 EXPO_PUBLIC_DEV_MACHINE_IP(예: 192.168.1.100)를 설정하세요.',
    });
    return url;
  }

  return url.replace('localhost', resolvedIp);
};

const resolveApiUrl = (): string => {
  const context: ApiUrlContext = {
    platform: process.env.EXPO_OS,
    env: extra.env,
    apiUrl: extra.apiUrl,
    isPhysicalDevice: Device.isDevice,
    devMachineIp: extra.devMachineIp,
  };

  const resolvedUrl = match(context)
    // Android 에뮬레이터: localhost → 10.0.2.2
    .with({ platform: 'android', env: 'development', isPhysicalDevice: false }, ({ apiUrl }) =>
      toAndroidEmulatorUrl(apiUrl),
    )
    // 실제 기기: localhost → DEV_MACHINE_IP
    .with({ env: 'development', isPhysicalDevice: true }, ({ apiUrl, devMachineIp }) =>
      toDeviceUrl(apiUrl, devMachineIp),
    )
    // 그 외: 원본 URL 사용
    .otherwise(({ apiUrl }) => apiUrl);

  // 개발 환경에서 디버깅 로그 출력
  if (extra.env === 'development' && __DEV__) {
    logger.debug(ENV_LOG_EVENT.API_URL_RESOLVED, {
      platform: context.platform,
      isPhysicalDevice: context.isPhysicalDevice,
      devMachineIp: context.devMachineIp || getAutoDetectedDevMachineIp() || 'auto-detect failed',
      original: context.apiUrl,
      resolved: resolvedUrl,
    });
  }

  return resolvedUrl;
};

const resolveScheme = (): string => {
  const scheme = Constants.expoConfig?.scheme;
  return Array.isArray(scheme) ? (scheme[0] ?? 'aido') : (scheme ?? 'aido');
};

// =============================================================================
// Environment Configuration
// =============================================================================

export const ENV = {
  APP_VERSION: Constants.expoConfig?.version,
  APP_ENV: extra.env,
  IS_DEV: extra.isDevelopment,
  IS_PRODUCTION: extra.isProduction,

  PLATFORM: process.env.EXPO_OS,
  IS_ANDROID: process.env.EXPO_OS === 'android',
  IS_IOS: process.env.EXPO_OS === 'ios',

  API_URL: resolveApiUrl(),
  SCHEME: resolveScheme(),
  REVENUECAT_API_KEY: resolveRevenueCatApiKey({
    isDebugBuild: __DEV__,
    isDevelopmentEnvironment: extra.isDevelopment,
    platform: process.env.EXPO_OS,
    appleApiKey: extra.revenueCatAppleApiKey,
    googleApiKey: extra.revenueCatGoogleApiKey,
    testApiKey: extra.revenueCatTestApiKey,
  }),

  // 카카오톡 공유 SDK 키(publishable). 없으면 OS 공유로 대신한다
  KAKAO_NATIVE_APP_KEY: extra.kakaoNativeAppKey,
  KAKAO_SCHEME: resolveKakaoScheme(extra.kakaoNativeAppKey),

  SENTRY_DSN: extra.sentryDsn,
  // 프로덕션이면 항상 활성. 개발/preview는 기본 비활성이며 EXPO_PUBLIC_SENTRY_DEBUG=true일 때만 활성(테스트용).
  SENTRY_ENABLED: extra.isProduction || extra.sentryDebug === true,
} as const;

export type Env = typeof ENV;

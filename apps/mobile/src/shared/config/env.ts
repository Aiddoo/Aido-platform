import { IS_PHYSICAL_DEVICE } from '@src/shared/infra/device/device-info';
import { logger } from '@src/shared/infra/logger/global-logger';
import { resolveRevenueCatApiKey } from '@src/shared/infra/purchases/revenuecat-api-key';
import Constants from 'expo-constants';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { getAppScheme } from './app-scheme';
import { ENV_LOG_EVENT } from './env-log-events';

const appEnvSchema = z.enum(['development', 'preview', 'production']);
type AppEnv = z.infer<typeof appEnvSchema>;

const extraSchema = z.object({
  env: appEnvSchema,
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

type PlatformType = typeof process.env.EXPO_OS;

type ApiUrlContext = {
  platform: PlatformType;
  env: AppEnv;
  apiUrl: string;
  isPhysicalDevice: boolean;
  devMachineIp?: string;
};

const extra = extraSchema.parse(Constants.expoConfig?.extra);

/** 카카오톡 공유 버튼이 앱을 여는 스킴(kakao{네이티브 앱 키}). 키가 없는 빌드는 null */
function resolveKakaoScheme(kakaoNativeAppKey: string | undefined) {
  return kakaoNativeAppKey == null ? null : `kakao${kakaoNativeAppKey}`;
}

/**
 * Expo Metro 번들러의 hostUri에서 개발 머신 IP를 자동으로 추출
 * 예: "192.168.1.100:8081" → "192.168.1.100"
 */
function getAutoDetectedDevMachineIp(): string | undefined {
  if (!__DEV__) {
    return undefined;
  }

  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) {
    return undefined;
  }

  const [ip] = hostUri.split(':');
  return ip;
}

function toAndroidEmulatorUrl(url: string): string {
  return url.replace('localhost', '10.0.2.2');
}

function toDeviceUrl(url: string, devMachineIp?: string): string {
  // 환경변수로 설정한 IP가 자동 감지한 IP보다 우선한다
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
}

function resolveApiUrl(): string {
  const context: ApiUrlContext = {
    platform: process.env.EXPO_OS,
    env: extra.env,
    apiUrl: extra.apiUrl,
    isPhysicalDevice: IS_PHYSICAL_DEVICE,
    devMachineIp: extra.devMachineIp,
  };

  const resolvedUrl = match(context)
    .with({ platform: 'android', env: 'development', isPhysicalDevice: false }, ({ apiUrl }) =>
      toAndroidEmulatorUrl(apiUrl),
    )
    .with({ env: 'development', isPhysicalDevice: true }, ({ apiUrl, devMachineIp }) =>
      toDeviceUrl(apiUrl, devMachineIp),
    )
    .otherwise(({ apiUrl }) => apiUrl);

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
}

export const ENV = {
  APP_VERSION: Constants.expoConfig?.version,
  APP_ENV: extra.env,
  IS_DEV: extra.isDevelopment,
  IS_PRODUCTION: extra.isProduction,

  PLATFORM: process.env.EXPO_OS,
  IS_ANDROID: process.env.EXPO_OS === 'android',
  IS_IOS: process.env.EXPO_OS === 'ios',

  API_URL: resolveApiUrl(),
  SCHEME: getAppScheme(),
  PURCHASES_API_KEY: resolveRevenueCatApiKey({
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

import { IS_PHYSICAL_DEVICE } from '@src/shared/infra/device/device-info';
import { logger } from '@src/shared/infra/logger/global-logger';
import Constants from 'expo-constants';
import { match } from 'ts-pattern';
import { z } from 'zod';

import { getAppScheme } from './app-scheme';
import { ENV_LOG_EVENT } from './env-log-events';

// app.config.ts가 빌드 때 APP_ENV를 같은 목록으로 검증해 extra.env로 넘긴다
const appEnvironmentSchema = z.enum(['development', 'preview', 'production']);
export type AppEnvironment = z.infer<typeof appEnvironmentSchema>;

const extraSchema = z.object({
  env: appEnvironmentSchema,
  apiUrl: z.string(),
  devMachineIp: z.string().optional(),
  sentryDsn: z.string().optional(),
  sentryDebug: z.boolean().optional(),
  // RevenueCat 공개 SDK 키. 테스트 키는 개발 번들에만 들어온다
  revenueCatAppleApiKey: z.string().optional(),
  revenueCatGoogleApiKey: z.string().optional(),
  revenueCatTestApiKey: z.string().optional(),
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
  env: AppEnvironment;
  apiUrl: string;
  isPhysicalDevice: boolean;
  devMachineIp?: string;
};

export interface TelemetryGates {
  /** Firebase Analytics·Sentry 보고기·Sentry 로거를 쓴다. 아니면 console 어댑터이고 네이티브 자동 수집은 내부 트래픽이다 */
  usesVendorAdapters: boolean;
  /** console 로거가 남기는 가장 낮은 수준 */
  consoleMinLevel: 'warn' | 'debug';
  /** `Sentry.init`의 enabled. JS 어댑터와 달리 운영이 아니어도 `EXPO_PUBLIC_SENTRY_DEBUG=true`면 SDK만 켠다 */
  isSentrySdkEnabled: boolean;
}

/** 어느 환경에서 관측 도구를 무엇으로 켜나를 여기서만 정한다 */
export function resolveTelemetryGates({
  appEnv,
  sentryDebug,
}: {
  appEnv: AppEnvironment;
  sentryDebug: boolean;
}): TelemetryGates {
  const isProduction = appEnv === 'production';
  return {
    usesVendorAdapters: isProduction,
    consoleMinLevel: isProduction ? 'warn' : 'debug',
    isSentrySdkEnabled: isProduction || sentryDebug,
  };
}

const extra = extraSchema.parse(Constants.expoConfig?.extra);

/** 카카오톡 공유 버튼이 앱을 여는 스킴(kakao{네이티브 앱 키}). 키가 없는 빌드는 null */
function resolveKakaoScheme(kakaoNativeAppKey: string | undefined) {
  return kakaoNativeAppKey == null ? null : `kakao${kakaoNativeAppKey}`;
}

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
        '.env.development에 EXPO_PUBLIC_DEV_MACHINE_IP(예: 192.168.1.100)를 설정하세요.',
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
  TELEMETRY: resolveTelemetryGates({ appEnv: extra.env, sentryDebug: extra.sentryDebug === true }),

  PLATFORM: process.env.EXPO_OS,

  API_URL: resolveApiUrl(),
  SCHEME: getAppScheme(),

  // 카카오톡 공유 SDK 키(publishable). 없으면 OS 공유로 대신한다
  KAKAO_NATIVE_APP_KEY: extra.kakaoNativeAppKey,
  KAKAO_SCHEME: resolveKakaoScheme(extra.kakaoNativeAppKey),

  SENTRY_DSN: extra.sentryDsn,

  REVENUECAT_API_KEYS: {
    apple: extra.revenueCatAppleApiKey,
    google: extra.revenueCatGoogleApiKey,
    test: extra.revenueCatTestApiKey,
  },
} as const;

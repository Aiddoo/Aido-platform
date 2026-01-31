import Constants from 'expo-constants';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { match } from 'ts-pattern';
import { z } from 'zod';

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
});

// =============================================================================
// Types
// =============================================================================

type PlatformType = 'ios' | 'android' | 'web' | 'windows' | 'macos';

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

/**
 * Expo Metro 번들러의 hostUri에서 개발 머신 IP를 자동으로 추출
 * 예: "192.168.1.100:8081" → "192.168.1.100"
 */
const getAutoDetectedDevMachineIp = (): string | undefined => {
  if (!__DEV__) return undefined;

  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return undefined;

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
    console.warn(
      '[env] 실제 기기에서 개발 서버에 연결할 수 없습니다.\n' +
        '- 개발 머신과 기기가 같은 Wi-Fi에 연결되어 있는지 확인하세요.\n' +
        '- 또는 .env.local 파일에 EXPO_PUBLIC_DEV_MACHINE_IP를 수동으로 설정하세요.\n' +
        '  예시: EXPO_PUBLIC_DEV_MACHINE_IP=192.168.1.100',
    );
    return url;
  }

  return url.replace('localhost', resolvedIp);
};

const resolveApiUrl = (): string => {
  const context: ApiUrlContext = {
    platform: Platform.OS as PlatformType,
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
    console.log('[env] API URL resolved:', {
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
  APP_ENV: extra.env,
  IS_DEV: extra.isDevelopment,
  IS_PRODUCTION: extra.isProduction,

  PLATFORM: Platform.OS as PlatformType,
  IS_ANDROID: Platform.OS === 'android',
  IS_IOS: Platform.OS === 'ios',

  API_URL: resolveApiUrl(),
  SCHEME: resolveScheme(),

  GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  KAKAO_CLIENT_ID: process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID,
  NAVER_CLIENT_ID: process.env.EXPO_PUBLIC_NAVER_CLIENT_ID,
  NAVER_CLIENT_SECRET: process.env.EXPO_PUBLIC_NAVER_CLIENT_SECRET,
} as const;

export type Env = typeof ENV;

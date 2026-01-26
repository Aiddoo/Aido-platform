import Constants from 'expo-constants';
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
};

// =============================================================================
// Environment Resolution
// =============================================================================

const extra = ExtraSchema.parse(Constants.expoConfig?.extra);

const toAndroidEmulatorUrl = (url: string): string => url.replace('localhost', '10.0.2.2');

const resolveApiUrl = (): string => {
  const context: ApiUrlContext = {
    platform: Platform.OS as PlatformType,
    env: extra.env,
    apiUrl: extra.apiUrl,
  };

  return match(context)
    .with({ platform: 'android', env: 'development' }, ({ apiUrl }) => toAndroidEmulatorUrl(apiUrl))
    .otherwise(({ apiUrl }) => apiUrl);
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

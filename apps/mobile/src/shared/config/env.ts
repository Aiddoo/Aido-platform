import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { z } from 'zod';

// ─────────────────────────────────────────────
// 상수
// ─────────────────────────────────────────────
const ANDROID_LOCALHOST = '10.0.2.2';
const DEFAULT_PORT = '8080';

// ─────────────────────────────────────────────
// 환경 타입
// ─────────────────────────────────────────────
type AppEnv = 'development' | 'preview' | 'production';

const getAppEnv = (): AppEnv => {
  const rawEnv = process.env.APP_ENV ?? process.env.NODE_ENV ?? 'development';

  if (rawEnv === 'production') return 'production';
  if (rawEnv === 'preview') return 'preview';
  return 'development';
};

const APP_ENV = getAppEnv();
const IS_DEV = APP_ENV === 'development';
const IS_PRODUCTION = APP_ENV === 'production' || APP_ENV === 'preview';

// ─────────────────────────────────────────────
// 환경변수 스키마
// ─────────────────────────────────────────────
const baseEnvSchema = z.object({
  EXPO_PUBLIC_API_URL: z.string().url().optional(),
  EXPO_PUBLIC_DEV_PORT: z.string().regex(/^\d+$/).optional(),
  EXPO_PUBLIC_LOCAL_IP: z
    .string()
    .regex(/^(\d{1,3}\.){3}\d{1,3}$/)
    .optional(),

  // OAuth
  EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID: z.string().min(1).optional(),
  EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: z.string().min(1).optional(),
  EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID: z.string().min(1).optional(),
  EXPO_PUBLIC_KAKAO_CLIENT_ID: z.string().min(1).optional(),
  EXPO_PUBLIC_NAVER_CLIENT_ID: z.string().min(1).optional(),
  EXPO_PUBLIC_NAVER_CLIENT_SECRET: z.string().min(1).optional(),
});

const productionEnvSchema = baseEnvSchema.extend({
  EXPO_PUBLIC_API_URL: z.string().url(),
});

// ─────────────────────────────────────────────
// 환경변수 파싱
// ─────────────────────────────────────────────
const parseEnv = () => {
  const schema = IS_PRODUCTION ? productionEnvSchema : baseEnvSchema;
  const result = schema.safeParse(process.env);

  if (!result.success) {
    const errors = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`);
    throw new Error(`[${APP_ENV}] 환경변수 검증 실패: ${errors.join(', ')}`);
  }

  return result.data;
};

const env = parseEnv();

// ─────────────────────────────────────────────
// 플랫폼 조건 (이름 붙이기)
// ─────────────────────────────────────────────
const isAndroid = (): boolean => Platform.OS === 'android';

const isPhysicalDeviceWithLocalIP = (): boolean => {
  return Constants.isDevice && !!env.EXPO_PUBLIC_LOCAL_IP;
};

// ─────────────────────────────────────────────
// 플랫폼별 URL 생성 (분리된 함수)
// ─────────────────────────────────────────────
const getUrlForPhysicalDevice = (port: string): string => {
  return `http://${env.EXPO_PUBLIC_LOCAL_IP}:${port}`;
};

const getUrlForAndroidEmulator = (port: string): string => {
  return `http://${ANDROID_LOCALHOST}:${port}`;
};

const getUrlForIOSSimulator = (port: string): string => {
  return `http://localhost:${port}`;
};

// ─────────────────────────────────────────────
// API URL 결정
// ─────────────────────────────────────────────
const convertLocalhostForAndroid = (url: string): string => {
  if (!isAndroid()) return url;
  return url.replace('localhost', ANDROID_LOCALHOST);
};

const getLocalDevUrl = (): string => {
  const port = env.EXPO_PUBLIC_DEV_PORT ?? DEFAULT_PORT;

  if (isPhysicalDeviceWithLocalIP()) {
    return getUrlForPhysicalDevice(port);
  }

  if (isAndroid()) {
    return getUrlForAndroidEmulator(port);
  }

  return getUrlForIOSSimulator(port);
};

const getProductionApiUrl = (): string => {
  return convertLocalhostForAndroid(env.EXPO_PUBLIC_API_URL as string);
};

const getDevelopmentApiUrl = (): string => {
  if (env.EXPO_PUBLIC_API_URL) {
    return convertLocalhostForAndroid(env.EXPO_PUBLIC_API_URL);
  }
  return getLocalDevUrl();
};

const getApiUrl = (): string => {
  return IS_PRODUCTION ? getProductionApiUrl() : getDevelopmentApiUrl();
};

// ─────────────────────────────────────────────
// 환경 설정 내보내기
// ─────────────────────────────────────────────
export const ENV = {
  APP_ENV,
  IS_DEV,
  IS_PRODUCTION,

  API_URL: getApiUrl(),

  GOOGLE_WEB_CLIENT_ID: env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID: env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID: env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  KAKAO_CLIENT_ID: env.EXPO_PUBLIC_KAKAO_CLIENT_ID,
  NAVER_CLIENT_ID: env.EXPO_PUBLIC_NAVER_CLIENT_ID,
  NAVER_CLIENT_SECRET: env.EXPO_PUBLIC_NAVER_CLIENT_SECRET,
} as const;

export type Env = typeof ENV;

import Constants from 'expo-constants';
import { z } from 'zod';

const AppEnvSchema = z.enum(['development', 'preview', 'production']);
export type AppEnv = z.infer<typeof AppEnvSchema>;

const ExtraSchema = z.object({
  env: AppEnvSchema,
  apiUrl: z.string(),
  isDevelopment: z.boolean(),
  isProduction: z.boolean(),
});

const extra = ExtraSchema.parse(Constants.expoConfig?.extra);

export const ENV = {
  // 환경
  APP_ENV: extra.env,
  IS_DEV: extra.isDevelopment,
  IS_PRODUCTION: extra.isProduction,

  // API
  API_URL: extra.apiUrl,

  // OAuth (EXPO_PUBLIC_* 환경변수는 빌드 시점에 번들에 포함됨)
  GOOGLE_WEB_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
  GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
  GOOGLE_ANDROID_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID,
  KAKAO_CLIENT_ID: process.env.EXPO_PUBLIC_KAKAO_CLIENT_ID,
  NAVER_CLIENT_ID: process.env.EXPO_PUBLIC_NAVER_CLIENT_ID,
  NAVER_CLIENT_SECRET: process.env.EXPO_PUBLIC_NAVER_CLIENT_SECRET,
} as const;

export type Env = typeof ENV;

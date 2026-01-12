import { z } from 'zod';

/**
 * 환경변수 스키마 정의
 * Zod를 사용하여 타입 안전성과 런타임 검증을 동시에 제공
 */
export const envSchema = z.object({
  // ==========================================================================
  // Server Configuration
  // ==========================================================================
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(8080),

  // ==========================================================================
  // Database Configuration
  // ==========================================================================
  DATABASE_URL: z.string().url(),

  // ==========================================================================
  // JWT Configuration (추후 인증 구현시 필수로 변경)
  // ==========================================================================
  JWT_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.string().default('1h'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // ==========================================================================
  // CORS Configuration
  // ==========================================================================
  CORS_ORIGINS: z.string().default('http://localhost:3000'),

  // ==========================================================================
  // Rate Limiting Configuration
  // ==========================================================================
  THROTTLE_TTL: z.coerce.number().default(60000), // 1분 (밀리초)
  THROTTLE_LIMIT: z.coerce.number().default(100), // 분당 최대 요청 수
});

export type EnvConfig = z.infer<typeof envSchema>;

/**
 * NestJS ConfigModule에서 사용할 검증 함수
 */
export function validateEnv(config: Record<string, unknown>): EnvConfig {
  const result = envSchema.safeParse(config);

  if (!result.success) {
    const errors = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');

    throw new Error(`환경변수 검증 실패:\n${errors}`);
  }

  return result.data;
}

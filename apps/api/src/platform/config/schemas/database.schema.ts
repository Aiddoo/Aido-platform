import { z } from "zod";

/**
 * 데이터베이스 설정 스키마
 */
export const databaseSchema = z.object({
  DATABASE_URL: z
    .url("DATABASE_URL must be a valid URL")
    .refine(
      (url) => url.startsWith("postgresql://") || url.startsWith("postgres://"),
      "DATABASE_URL must be a PostgreSQL connection string",
    ),
  DATABASE_POOL_MAX: z.coerce.number().int().positive().default(10),
  // 비우면 pg 기본값(유휴 10초, 연결 대기 무제한)을 쓴다.
  DATABASE_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().optional(),
  DATABASE_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().nonnegative().optional(),
});

export type DatabaseConfig = z.infer<typeof databaseSchema>;

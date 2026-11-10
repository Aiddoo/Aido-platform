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
  // 비우면 pg 기본값(유휴 10초)을 쓴다.
  DATABASE_POOL_IDLE_TIMEOUT_MS: z.coerce.number().int().nonnegative().optional(),
  // 풀이 가득 찼을 때 무한히 기다리지 않고 빨리 실패한다. 0이면 pg 기본값(무제한)이다.
  DATABASE_POOL_CONNECTION_TIMEOUT_MS: z.coerce.number().int().nonnegative().default(5_000),
  // 인증서 문제로 DB에 붙지 못할 때만 쓰는 비상 스위치
  DATABASE_SSL_ALLOW_UNVERIFIED: z.stringbool().default(false),
});

export type DatabaseConfig = z.infer<typeof databaseSchema>;

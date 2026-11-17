import { z } from "zod";

/**
 * JWT 인증 설정 스키마
 */
export const jwtSchema = z.object({
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("15m"),
  // 회전마다 새로 계산해 쓰는 동안은 만료되지 않는다(sliding). 30일 넘게 쓰지 않은 기기만 다시 로그인한다
  JWT_REFRESH_EXPIRES_IN: z.string().default("30d"),
});

export type JwtConfig = z.infer<typeof jwtSchema>;

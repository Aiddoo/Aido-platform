import ms from "ms";
import { z } from "zod";

// jsonwebtoken이 그대로 받는 ms 형식("15m"·"30d") 중 예전 설정이 쓰던 정수+단위만 받고 0초 이하는 시작에서 막는다
const tokenLifetimeSchema = z
  .templateLiteral([z.int(), z.enum(["s", "m", "h", "d"])])
  .refine((lifetime) => ms(lifetime) > 0, "JWT lifetime must be positive");

/**
 * JWT 인증 설정 스키마
 */
export const jwtSchema = z.object({
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: tokenLifetimeSchema.default("15m"),
  // 회전마다 새로 계산해 쓰는 동안은 만료되지 않는다(sliding). 30일 넘게 쓰지 않은 기기만 다시 로그인한다
  JWT_REFRESH_EXPIRES_IN: tokenLifetimeSchema.default("30d"),
});

export type JwtConfig = z.infer<typeof jwtSchema>;

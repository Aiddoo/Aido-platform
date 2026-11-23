import ms from "ms";
import { z } from "zod";

import { DAY_MS } from "#api/shared/domain/time/time-units";

// access를 짧게 둬야 refresh 회전·재사용 탐지가 뜻이 있어 하루를 넘기지 않는다
const ACCESS_TOKEN_MAX_LIFETIME_MS = DAY_MS;
// 만료 시각이 Temporal 범위를 넘으면 로그인마다 RangeError라 시작에서 1년으로 묶는다
const REFRESH_TOKEN_MAX_LIFETIME_MS = 365 * DAY_MS;

// jsonwebtoken이 그대로 받는 ms 형식("15m"·"30d") 중 예전 설정이 쓰던 정수+단위만 받고 0초 이하는 시작에서 막는다
function tokenLifetimeSchema(maxLifetimeMs: number, maxLabel: string) {
  return z
    .templateLiteral([z.int(), z.enum(["s", "m", "h", "d"])])
    .refine((lifetime) => ms(lifetime) > 0, "JWT lifetime must be positive")
    .refine(
      (lifetime) => ms(lifetime) <= maxLifetimeMs,
      `JWT lifetime must be at most ${maxLabel}`,
    );
}

export const jwtSchema = z.object({
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_REFRESH_SECRET: z.string().min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: tokenLifetimeSchema(ACCESS_TOKEN_MAX_LIFETIME_MS, "1d").default("15m"),
  // 회전마다 새로 계산해 쓰는 동안은 만료되지 않는다(sliding). 30일 넘게 쓰지 않은 기기만 다시 로그인한다
  JWT_REFRESH_EXPIRES_IN: tokenLifetimeSchema(REFRESH_TOKEN_MAX_LIFETIME_MS, "365d").default("30d"),
});

export type JwtConfig = z.infer<typeof jwtSchema>;

/** access가 refresh보다 길면 refresh 만료 뒤에도 access가 살아 있어 시작을 거부한다 */
export function validateJwtLifetimes({
  value: config,
  issues,
}: z.core.ParsePayload<Pick<JwtConfig, "JWT_EXPIRES_IN" | "JWT_REFRESH_EXPIRES_IN">>): void {
  if (ms(config.JWT_EXPIRES_IN) >= ms(config.JWT_REFRESH_EXPIRES_IN)) {
    issues.push({
      code: "custom",
      input: config,
      path: ["JWT_EXPIRES_IN"],
      message: "JWT_EXPIRES_IN must be shorter than JWT_REFRESH_EXPIRES_IN",
    });
  }
}

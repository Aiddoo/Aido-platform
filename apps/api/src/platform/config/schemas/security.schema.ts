import { z } from "zod";

import { parseSigningKeys } from "#api/platform/security/signing-key-ring";

/**
 * CORS 설정 스키마
 */
export const corsSchema = z.object({
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:8081")
    .transform((val) => val.split(",").map((origin) => origin.trim())),
});

/**
 * Rate Limiting 설정 스키마
 */
export const throttleSchema = z.object({
  THROTTLE_TTL: z.coerce.number().int().positive().default(60_000),
  THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
});

/**
 * 토큰 암호화 설정 스키마
 */
export const encryptionSchema = z.object({
  TOKEN_ENCRYPTION_KEY: z.string().min(32),
  TOKEN_ENCRYPTION_SALT: z.string().min(8).optional(),
});

const signingKeysSchema = z
  .string()
  .optional()
  .check((context) => {
    const value = context.value?.trim();
    if (value == null || value === "") {
      return;
    }
    const parsed = parseSigningKeys(value);
    if (!parsed.success) {
      context.issues.push({ code: "custom", input: context.value, message: parsed.reason });
    }
  });

// 비우면 커서·광고 수신 거부 토큰을 지금처럼 JWT_SECRET으로 서명한다.
export const tokenSigningSchema = z.object({
  CURSOR_SIGNING_KEYS: signingKeysSchema,
  OPT_OUT_TOKEN_SIGNING_KEYS: signingKeysSchema,
});

/**
 * 통합 보안 설정 스키마
 */
export const securitySchema = z.object({
  ...corsSchema.shape,
  ...throttleSchema.shape,
  ...encryptionSchema.shape,
  ...tokenSigningSchema.shape,
});

export type SecurityConfig = z.infer<typeof securitySchema>;

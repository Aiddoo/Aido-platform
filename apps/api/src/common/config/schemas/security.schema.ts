import { z } from "zod";

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
	THROTTLE_TTL: z.coerce.number().int().positive().default(60000),
	THROTTLE_LIMIT: z.coerce.number().int().positive().default(100),
});

/**
 * 토큰 암호화 설정 스키마
 */
export const encryptionSchema = z.object({
	TOKEN_ENCRYPTION_KEY: z.string().min(32),
});

/**
 * 통합 보안 설정 스키마
 */
export const securitySchema = z
	.object({})
	.merge(corsSchema)
	.merge(throttleSchema)
	.merge(encryptionSchema);

export type CorsConfig = z.infer<typeof corsSchema>;
export type ThrottleConfig = z.infer<typeof throttleSchema>;
export type EncryptionConfig = z.infer<typeof encryptionSchema>;
export type SecurityConfig = z.infer<typeof securitySchema>;

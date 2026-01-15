import { z } from "zod";

/**
 * JWT 인증 설정 스키마
 */
export const jwtSchema = z.object({
	JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
	JWT_REFRESH_SECRET: z
		.string()
		.min(32, "JWT_REFRESH_SECRET must be at least 32 characters"),
	JWT_EXPIRES_IN: z.string().default("15m"),
	JWT_REFRESH_EXPIRES_IN: z.string().default("7d"),
});

export type JwtConfig = z.infer<typeof jwtSchema>;

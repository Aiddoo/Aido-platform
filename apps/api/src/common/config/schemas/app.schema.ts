import { z } from "zod";

/**
 * 애플리케이션 기본 설정 스키마
 */
export const appSchema = z.object({
	NODE_ENV: z
		.enum(["development", "production", "test"])
		.default("development"),
	PORT: z.coerce.number().int().positive().default(8080),
});

export type AppConfig = z.infer<typeof appSchema>;

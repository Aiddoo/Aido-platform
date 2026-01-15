import { z } from "zod";

/**
 * 데이터베이스 설정 스키마
 */
export const databaseSchema = z.object({
	DATABASE_URL: z
		.string()
		.url("DATABASE_URL must be a valid URL")
		.refine(
			(url) => url.startsWith("postgresql://") || url.startsWith("postgres://"),
			"DATABASE_URL must be a PostgreSQL connection string",
		),
});

export type DatabaseConfig = z.infer<typeof databaseSchema>;

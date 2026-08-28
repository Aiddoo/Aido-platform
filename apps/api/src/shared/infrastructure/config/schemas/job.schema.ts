import { z } from "zod";

export const jobSchema = z.object({
	JOB_BACKEND: z.enum(["postgres", "redis"]).default("postgres"),
	JOB_REDIS_DRAIN_ENABLED: z.stringbool().default(false),
	JOB_SCHEMA: z.string().min(1).default("pgboss"),
	JOB_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
	JOB_POLLING_INTERVAL_SECONDS: z.coerce.number().int().positive().default(2),
});

export type JobConfig = z.infer<typeof jobSchema>;

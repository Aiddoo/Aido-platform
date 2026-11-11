import { z } from "zod";

export const jobSchema = z.object({
  JOB_SCHEMA: z.string().min(1).default("pgboss"),
  JOB_SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(90_000),
});

export type JobConfig = z.infer<typeof jobSchema>;

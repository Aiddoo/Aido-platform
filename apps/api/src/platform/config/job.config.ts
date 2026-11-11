import { defineConfig } from "./define-config.js";
import { jobSchema } from "./schemas/job.schema.js";

export const jobConfig = defineConfig(
  "job",
  jobSchema.transform((env) => ({
    schema: env.JOB_SCHEMA,
    shutdownTimeoutMs: env.JOB_SHUTDOWN_TIMEOUT_MS,
  })),
  (env) => ({
    JOB_SCHEMA: env.JOB_SCHEMA,
    JOB_SHUTDOWN_TIMEOUT_MS: env.JOB_SHUTDOWN_TIMEOUT_MS,
  }),
);

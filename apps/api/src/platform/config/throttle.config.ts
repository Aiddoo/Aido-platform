import { defineConfig } from "./define-config.js";
import { throttleSchema } from "./schemas/security.schema.js";

export const throttleConfig = defineConfig(
  "throttle",
  throttleSchema.transform((env) => ({ ttlMs: env.THROTTLE_TTL, limit: env.THROTTLE_LIMIT })),
  (env) => ({ THROTTLE_TTL: env.THROTTLE_TTL, THROTTLE_LIMIT: env.THROTTLE_LIMIT }),
);

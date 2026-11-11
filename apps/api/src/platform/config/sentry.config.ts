import { defineConfig } from "./define-config.js";
import { externalSchema } from "./schemas/external.schema.js";

/** SDK 초기화는 Nest보다 먼저 도는 instrument.ts가 맡는다. 이 값은 앱 안에서 읽는 용도다. */
export const sentryConfig = defineConfig(
  "sentry",
  externalSchema
    .pick({ SENTRY_DSN: true, SENTRY_TRACES_SAMPLE_RATE: true })
    .transform((env) => ({ dsn: env.SENTRY_DSN, tracesSampleRate: env.SENTRY_TRACES_SAMPLE_RATE })),
  (env) => ({
    SENTRY_DSN: env.SENTRY_DSN,
    SENTRY_TRACES_SAMPLE_RATE: env.SENTRY_TRACES_SAMPLE_RATE,
  }),
);

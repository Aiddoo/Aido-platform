import { z } from 'zod';

/** Shared by the Zod API contract and its OpenAPI projection. */
export const featureDiscoveryMinAppVersionPattern =
  '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)(?:-[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?(?:\\+[0-9A-Za-z-]+(?:\\.[0-9A-Za-z-]+)*)?$';

/**
 * UTC-only ISO datetime pattern matching Zod's default `z.iso.datetime()`
 * precision and calendar-date rules, with offsets intentionally excluded.
 */
export const featureDiscoveryUtcDateTimePattern =
  '^(?:(?:\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-(?:(?:0[13578]|1[02])-(?:0[1-9]|[12]\\d|3[01])|(?:0[469]|11)-(?:0[1-9]|[12]\\d|30)|(?:02)-(?:0[1-9]|1\\d|2[0-8])))T(?:[01]\\d|2[0-3]):[0-5]\\d(?::[0-5]\\d(?:\\.\\d+)?)?Z$';

export const featureDiscoveryMinAppVersionSchema = z
  .string()
  .regex(new RegExp(featureDiscoveryMinAppVersionPattern), 'Must be a semantic version');

export const featureDiscoveryLaunchedAtSchema = z
  .string()
  .regex(new RegExp(featureDiscoveryUtcDateTimePattern), 'Must be a UTC ISO datetime');

export const featureDiscoveryResponseSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }).strict(),
  z
    .object({
      enabled: z.literal(true),
      campaignId: z.string().min(1),
      minAppVersion: featureDiscoveryMinAppVersionSchema,
      launchedAt: featureDiscoveryLaunchedAtSchema,
      autoOpen: z.boolean(),
    })
    .strict(),
]);

export type FeatureDiscoveryResponse = z.infer<typeof featureDiscoveryResponseSchema>;

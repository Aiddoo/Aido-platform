import { z } from 'zod';

const semverSchema = z
  .string()
  .regex(
    /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?(?:\+[0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*)?$/,
    'Must be a semantic version',
  );

export const featureDiscoveryResponseSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }).strict(),
  z
    .object({
      enabled: z.literal(true),
      campaignId: z.string().min(1),
      minAppVersion: semverSchema,
      launchedAt: z.iso.datetime(),
      autoOpen: z.boolean(),
    })
    .strict(),
]);

export type FeatureDiscoveryResponse = z.infer<typeof featureDiscoveryResponseSchema>;

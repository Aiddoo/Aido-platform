import { featureDiscoveryMinAppVersionSchema } from '@aido/api';
import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

export const whatsNewAppVersionSchema = featureDiscoveryMinAppVersionSchema;

const whatsNewConfigSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    campaignId: z.string(),
    minAppVersion: z.string(),
    launchedAt: instantSchema,
    autoOpen: z.boolean(),
  }),
]);
export type WhatsNewConfig = z.infer<typeof whatsNewConfigSchema>;

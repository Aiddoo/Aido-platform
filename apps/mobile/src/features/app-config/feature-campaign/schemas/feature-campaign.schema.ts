import { instantSchema } from '@src/shared/date/instant';
import { z } from 'zod';

const featureCampaignConfigSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    campaignId: z.string(),
    minAppVersion: z.string(),
    launchedAt: instantSchema,
    autoOpen: z.boolean(),
  }),
]);
export type FeatureCampaignConfig = z.infer<typeof featureCampaignConfigSchema>;

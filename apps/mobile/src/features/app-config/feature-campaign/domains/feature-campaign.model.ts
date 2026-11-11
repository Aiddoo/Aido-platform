import { z } from 'zod';

// 응답의 launchedAt은 1.15.0 이하 앱만 읽는다. 이 앱은 가입 시점을 보지 않아 모델에 두지 않는다
const featureCampaignConfigSchema = z.discriminatedUnion('enabled', [
  z.object({ enabled: z.literal(false) }),
  z.object({
    enabled: z.literal(true),
    campaignId: z.string(),
    minAppVersion: z.string(),
    autoOpen: z.boolean(),
  }),
]);
export type FeatureCampaignConfig = z.infer<typeof featureCampaignConfigSchema>;

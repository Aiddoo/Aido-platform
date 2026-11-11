import {
  broadcastCampaignAcceptedSchema,
  broadcastCampaignIdParamSchema,
  broadcastCampaignSchema,
  createBroadcastCampaignSchema,
} from "@aido/api/contracts/admin";
import type { z } from "zod";

export const CreateBroadcastCampaignDto = createBroadcastCampaignSchema.meta({
  id: "CreateBroadcastCampaignDto",
});
export type CreateBroadcastCampaignDto = z.infer<typeof CreateBroadcastCampaignDto>;

export const BroadcastCampaignIdParamDto = broadcastCampaignIdParamSchema.meta({
  id: "BroadcastCampaignIdParamDto",
  apiParameter: true,
});
export type BroadcastCampaignIdParamDto = z.infer<typeof BroadcastCampaignIdParamDto>;

export const BroadcastCampaignAcceptedDto = broadcastCampaignAcceptedSchema.meta({
  id: "BroadcastCampaignAcceptedDto",
});
export type BroadcastCampaignAcceptedDto = z.infer<typeof BroadcastCampaignAcceptedDto>;

export const BroadcastCampaignDto = broadcastCampaignSchema.meta({ id: "BroadcastCampaignDto" });
export type BroadcastCampaignDto = z.infer<typeof BroadcastCampaignDto>;

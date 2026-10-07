import { marketingPushOptOutResponseSchema, marketingPushOptOutSchema } from "@aido/api";
import type { z } from "zod";

export const MarketingPushOptOutDto = marketingPushOptOutSchema.meta({
  id: "MarketingPushOptOutDto",
});
export type MarketingPushOptOutDto = z.infer<typeof MarketingPushOptOutDto>;
export const MarketingPushOptOutResponseDto = marketingPushOptOutResponseSchema.meta({
  id: "MarketingPushOptOutResponseDto",
});
export type MarketingPushOptOutResponseDto = z.infer<typeof MarketingPushOptOutResponseDto>;

import {
  updateMarketingConsentSchema,
  updateMarketingPushConsentSchema,
  updatePreferenceSchema,
} from "@aido/api";
import type { z } from "zod";

export const UpdatePreferenceDto = updatePreferenceSchema.meta({ id: "UpdatePreferenceDto" });
export type UpdatePreferenceDto = z.infer<typeof UpdatePreferenceDto>;

export const UpdateMarketingConsentDto = updateMarketingConsentSchema.meta({
  id: "UpdateMarketingConsentDto",
});
export type UpdateMarketingConsentDto = z.infer<typeof UpdateMarketingConsentDto>;
export const UpdateMarketingPushConsentDto = updateMarketingPushConsentSchema.meta({
  id: "UpdateMarketingPushConsentDto",
});
export type UpdateMarketingPushConsentDto = z.infer<typeof UpdateMarketingPushConsentDto>;

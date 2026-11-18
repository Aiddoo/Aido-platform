import {
  updateAiDataSharingConsentSchema,
  updateMarketingConsentSchema,
  updateMarketingPushConsentSchema,
} from "@aido/api/contracts/user-consent/v1";
import { updatePreferenceSchema } from "@aido/api/contracts/user-preference/v1";
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
export const UpdateAiDataSharingConsentDto = updateAiDataSharingConsentSchema.meta({
  id: "UpdateAiDataSharingConsentDto",
});
export type UpdateAiDataSharingConsentDto = z.infer<typeof UpdateAiDataSharingConsentDto>;

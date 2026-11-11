import {
  consentResponseSchema,
  preferenceResponseSchema,
  updateAiDataSharingConsentResponseSchema,
  updateMarketingConsentResponseSchema,
  updateMarketingPushConsentResponseSchema,
  updatePreferenceResponseSchema,
} from "@aido/api";
import type { z } from "zod";

export const PreferenceResponseDto = preferenceResponseSchema.meta({ id: "PreferenceResponseDto" });
export type PreferenceResponseDto = z.infer<typeof PreferenceResponseDto>;
export const UpdatePreferenceResponseDto = updatePreferenceResponseSchema.meta({
  id: "UpdatePreferenceResponseDto",
});
export type UpdatePreferenceResponseDto = z.infer<typeof UpdatePreferenceResponseDto>;
export const ConsentResponseDto = consentResponseSchema.meta({ id: "ConsentResponseDto" });
export type ConsentResponseDto = z.infer<typeof ConsentResponseDto>;
export const UpdateMarketingConsentResponseDto = updateMarketingConsentResponseSchema.meta({
  id: "UpdateMarketingConsentResponseDto",
});
export type UpdateMarketingConsentResponseDto = z.infer<typeof UpdateMarketingConsentResponseDto>;
export const UpdateMarketingPushConsentResponseDto = updateMarketingPushConsentResponseSchema.meta({
  id: "UpdateMarketingPushConsentResponseDto",
});
export type UpdateMarketingPushConsentResponseDto = z.infer<
  typeof UpdateMarketingPushConsentResponseDto
>;
export const UpdateAiDataSharingConsentResponseDto = updateAiDataSharingConsentResponseSchema.meta({
  id: "UpdateAiDataSharingConsentResponseDto",
});
export type UpdateAiDataSharingConsentResponseDto = z.infer<
  typeof UpdateAiDataSharingConsentResponseDto
>;

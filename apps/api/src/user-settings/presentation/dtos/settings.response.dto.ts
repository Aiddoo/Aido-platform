import {
	consentResponseSchema,
	preferenceResponseSchema,
	updateMarketingConsentResponseSchema,
	updateMarketingPushConsentResponseSchema,
	updatePreferenceResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class PreferenceResponseDto extends createZodDto(preferenceResponseSchema) {}
export class UpdatePreferenceResponseDto extends createZodDto(updatePreferenceResponseSchema) {}
export class ConsentResponseDto extends createZodDto(consentResponseSchema) {}
export class UpdateMarketingConsentResponseDto extends createZodDto(
	updateMarketingConsentResponseSchema,
) {}
export class UpdateMarketingPushConsentResponseDto extends createZodDto(
	updateMarketingPushConsentResponseSchema,
) {}

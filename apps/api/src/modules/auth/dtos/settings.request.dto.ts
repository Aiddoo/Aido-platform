import {
	updateMarketingConsentSchema,
	updatePreferenceSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UpdatePreferenceDto extends createZodDto(updatePreferenceSchema) {}

export class UpdateMarketingConsentDto extends createZodDto(
	updateMarketingConsentSchema,
) {}

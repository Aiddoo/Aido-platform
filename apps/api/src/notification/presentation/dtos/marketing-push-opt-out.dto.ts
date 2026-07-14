import {
	marketingPushOptOutResponseSchema,
	marketingPushOptOutSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class MarketingPushOptOutDto extends createZodDto(
	marketingPushOptOutSchema,
) {}
export class MarketingPushOptOutResponseDto extends createZodDto(
	marketingPushOptOutResponseSchema,
) {}

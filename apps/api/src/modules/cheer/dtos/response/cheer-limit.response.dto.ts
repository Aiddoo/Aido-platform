import {
	cheerLimitInfoSchema,
	createCheerResponseSchema,
	markCheerReadResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class CheerLimitInfoDto extends createZodDto(cheerLimitInfoSchema) {}

export class CreateCheerResponseDto extends createZodDto(
	createCheerResponseSchema,
) {}

export class MarkCheerReadResponseDto extends createZodDto(
	markCheerReadResponseSchema,
) {}

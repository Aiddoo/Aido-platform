import {
	cheerDetailSchema,
	receivedCheersResponseSchema,
	sentCheersResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class CheerDetailDto extends createZodDto(cheerDetailSchema) {}

export class ReceivedCheersResponseDto extends createZodDto(
	receivedCheersResponseSchema,
) {}

export class SentCheersResponseDto extends createZodDto(
	sentCheersResponseSchema,
) {}

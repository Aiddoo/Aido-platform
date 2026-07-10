import { unreadCountResponseSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class UnreadCountResponseDto extends createZodDto(
	unreadCountResponseSchema,
) {}

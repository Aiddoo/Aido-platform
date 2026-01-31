import { registerTokenResponseSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class RegisterTokenResponseDto extends createZodDto(
	registerTokenResponseSchema,
) {}

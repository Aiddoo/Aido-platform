import { cheerCooldownInfoSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class CheerCooldownResponseDto extends createZodDto(
	cheerCooldownInfoSchema,
) {}

import { nudgeCooldownInfoSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class NudgeCooldownResponseDto extends createZodDto(
	nudgeCooldownInfoSchema,
) {}

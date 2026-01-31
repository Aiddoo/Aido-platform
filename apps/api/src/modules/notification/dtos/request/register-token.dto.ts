import { registerPushTokenSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class RegisterPushTokenDto extends createZodDto(
	registerPushTokenSchema,
) {}

/**
 * 푸시 토큰 등록 요청 DTO
 */
import { registerPushTokenSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class RegisterPushTokenDto extends createZodDto(
	registerPushTokenSchema,
) {}

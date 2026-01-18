/**
 * 푸시 토큰 등록 응답 DTO
 */
import { registerTokenResponseSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class RegisterTokenResponseDto extends createZodDto(
	registerTokenResponseSchema,
) {}

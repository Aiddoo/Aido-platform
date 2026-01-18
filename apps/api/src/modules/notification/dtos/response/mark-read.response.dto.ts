/**
 * 알림 읽음 처리 응답 DTO
 */
import { markReadResponseSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

export class MarkReadResponseDto extends createZodDto(markReadResponseSchema) {}

import { broadcastResultSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

/**
 * 알림 발송 결과 응답 DTO
 */
export class BroadcastResultDto extends createZodDto(broadcastResultSchema) {}

/**
 * Cheer 쿨다운 Response DTO
 *
 * 쿨다운 상태 정보를 담는 응답 DTO
 */

import { cheerCooldownInfoSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

/**
 * 쿨다운 상태 응답 DTO
 *
 * @property canCheer - 응원 가능 여부
 * @property remainingSeconds - 남은 쿨다운 시간 (초)
 * @property cooldownEndsAt - 다시 응원할 수 있는 시각 (ISO 8601, null = 바로 가능)
 */
export class CheerCooldownResponseDto extends createZodDto(
	cheerCooldownInfoSchema,
) {}

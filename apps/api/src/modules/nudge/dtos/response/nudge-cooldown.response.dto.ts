/**
 * Nudge 쿨다운 Response DTO
 *
 * 쿨다운 상태 정보를 담는 응답 DTO
 */

import { nudgeCooldownInfoSchema } from "@aido/validators";
import { createZodDto } from "nestjs-zod";

/**
 * 쿨다운 상태 응답 DTO
 *
 * @property isOnCooldown - 쿨다운 중 여부
 * @property remainingSeconds - 남은 쿨다운 시간 (초)
 * @property canNudgeAt - 다시 찌를 수 있는 시각 (ISO 8601, null = 바로 가능)
 */
export class NudgeCooldownResponseDto extends createZodDto(
	nudgeCooldownInfoSchema,
) {}

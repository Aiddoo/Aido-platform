/**
 * Settings Request DTOs (NestJS)
 *
 * nestjs-zod의 createZodDto를 사용한 NestJS DTO 클래스
 */

import {
	updateMarketingConsentSchema,
	updatePreferenceSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

// ============================================
// 푸시 설정 요청 DTO
// ============================================

/** 푸시 설정 수정 요청 DTO */
export class UpdatePreferenceDto extends createZodDto(updatePreferenceSchema) {}

// ============================================
// 동의 상태 요청 DTO
// ============================================

/** 마케팅 동의 변경 요청 DTO */
export class UpdateMarketingConsentDto extends createZodDto(
	updateMarketingConsentSchema,
) {}

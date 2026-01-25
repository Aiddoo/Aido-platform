/**
 * Settings Response DTOs (NestJS)
 *
 * nestjs-zod의 createZodDto를 사용한 NestJS DTO 클래스
 */

import {
	consentResponseSchema,
	preferenceResponseSchema,
	updateMarketingConsentResponseSchema,
	updatePreferenceResponseSchema,
} from "@aido/validators";
import { createZodDto } from "nestjs-zod";

// ============================================
// 푸시 설정 응답 DTO
// ============================================

/** 푸시 설정 조회 응답 DTO */
export class PreferenceResponseDto extends createZodDto(
	preferenceResponseSchema,
) {}

/** 푸시 설정 수정 응답 DTO */
export class UpdatePreferenceResponseDto extends createZodDto(
	updatePreferenceResponseSchema,
) {}

// ============================================
// 동의 상태 응답 DTO
// ============================================

/** 동의 상태 조회 응답 DTO */
export class ConsentResponseDto extends createZodDto(consentResponseSchema) {}

/** 마케팅 동의 변경 응답 DTO */
export class UpdateMarketingConsentResponseDto extends createZodDto(
	updateMarketingConsentResponseSchema,
) {}

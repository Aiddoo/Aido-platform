/**
 * @aido/validators
 *
 * Zod 스키마 기반 타입 및 유효성 검증 패키지
 *
 * @description
 * 이 패키지는 API 계약의 단일 소스로서 Zod 스키마를 정의하고,
 * TypeScript 타입을 자동으로 추출합니다.
 *
 * @example
 * ```typescript
 * // 타입 import
 * import type { ApiResponse, PaginationQuery } from '@aido/validators';
 *
 * // 스키마 import (런타임 검증용)
 * import { apiErrorSchema, paginationQuerySchema } from '@aido/validators';
 *
 * // 팩토리 함수로 커스텀 응답 스키마 생성
 * import { createApiResponseSchema, userSchema } from '@aido/validators';
 * const userResponseSchema = createApiResponseSchema(userSchema);
 * ```
 */

// Zod core
export { z } from 'zod';

// Common schemas & types
export * from './common';

// Domain schemas
export * from './todo';

// 향후 추가 예정
// export * from './user';
// export * from './auth';

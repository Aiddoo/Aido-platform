/**
 * API 응답 스키마 및 타입
 *
 * @description
 * Zod 스키마를 단일 소스로 사용하여 타입과 런타임 검증을 동기화합니다.
 *
 * @example
 * ```typescript
 * // 타입으로 사용
 * const response: ApiResponse<User> = { ... };
 *
 * // 런타임 검증
 * const result = createApiResponseSchema(userSchema).safeParse(data);
 * ```
 */

import { z } from 'zod';

// =============================================================================
// Pagination
// =============================================================================

/**
 * 페이지네이션 메타데이터 스키마
 */
export const paginationMetaSchema = z.object({
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  limit: z.number().int().positive(),
  totalPages: z.number().int().nonnegative(),
});

export type PaginationMeta = z.infer<typeof paginationMetaSchema>;

// =============================================================================
// API Response
// =============================================================================

/**
 * 표준 API 응답 스키마 팩토리
 *
 * @param dataSchema - 응답 데이터의 Zod 스키마
 * @returns API 응답 전체 스키마
 *
 * @example
 * ```typescript
 * const userResponseSchema = createApiResponseSchema(userSchema);
 * type UserResponse = z.infer<typeof userResponseSchema>;
 * ```
 */
export function createApiResponseSchema<T extends z.ZodTypeAny>(dataSchema: T) {
  return z.object({
    success: z.literal(true),
    data: dataSchema,
    message: z.string().optional(),
    timestamp: z.string().datetime(),
  });
}

/**
 * 페이지네이션 응답 스키마 팩토리
 */
export function createPaginatedResponseSchema<T extends z.ZodTypeAny>(itemSchema: T) {
  return z.object({
    items: z.array(itemSchema),
    meta: paginationMetaSchema,
  });
}

// =============================================================================
// Generic Types (for TypeScript usage without schema)
// =============================================================================

/**
 * 표준 API 응답 타입 (제네릭)
 */
export interface ApiResponse<T> {
  success: true;
  data: T;
  message?: string;
  timestamp: string;
}

/**
 * 페이지네이션 응답 타입 (제네릭)
 */
export interface PaginatedResponse<T> {
  items: T[];
  meta: PaginationMeta;
}

/**
 * @aido/validators
 *
 * Zod 스키마 기반 타입 및 유효성 검증 패키지
 *
 * @description
 * 이 패키지는 입력 검증을 위한 Zod 스키마를 정의하고,
 * TypeScript 타입을 자동으로 추출합니다.
 *
 * 주요 역할:
 * - Request DTO 스키마 (create, update)
 * - 엔티티 스키마 (응답 검증용)
 * - 쿼리 파라미터 스키마 (pagination, sort)
 *
 * @example
 * ```typescript
 * // 타입 import
 * import type { Todo, TodoCreate, TodoUpdate, PaginationQuery } from '@aido/validators';
 *
 * // 스키마 import (런타임 검증용)
 * import { todoSchema, todoCreateSchema, paginationQuerySchema } from '@aido/validators';
 * ```
 */

// Zod core
export { z } from 'zod';

// Common schemas & types
export * from './common';
export * from './domains/auth';
// Domain schemas
export * from './domains/todo';

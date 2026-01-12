/**
 * Todo 도메인 스키마 및 타입
 *
 * @description
 * Todo 관련 Zod 스키마를 정의하고 TypeScript 타입을 추출합니다.
 * API와 Frontend에서 공유하여 타입 안전성을 보장합니다.
 *
 * @example
 * ```typescript
 * // Backend (NestJS)
 * import { todoCreateSchema, type TodoCreate } from '@aido/validators';
 *
 * // Frontend (React Native)
 * import { type Todo, type TodoUpdate } from '@aido/validators';
 * ```
 */

import { z } from 'zod';

// =============================================================================
// Todo Entity Schema
// =============================================================================

/**
 * Todo 엔티티 스키마 (전체 필드)
 *
 * @description
 * Prisma에서 반환하는 Todo 엔티티의 전체 구조입니다.
 * Date 객체는 JSON 직렬화 시 ISO 8601 문자열로 변환되므로
 * z.string().datetime()을 사용합니다.
 */
export const todoSchema = z.object({
  id: z.number().int().positive(),
  title: z.string(),
  content: z.string().nullable(),
  completed: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type Todo = z.infer<typeof todoSchema>;

// =============================================================================
// Todo Create Schema
// =============================================================================

/**
 * Todo 생성 요청 스키마
 *
 * @description
 * POST /todos 요청 시 사용되는 스키마입니다.
 * id, createdAt, updatedAt는 서버에서 자동 생성됩니다.
 */
export const todoCreateSchema = z.object({
  title: z.string().min(1, '제목은 필수입니다').max(100, '제목은 100자를 초과할 수 없습니다'),
  content: z.string().max(500, '내용은 500자를 초과할 수 없습니다').optional(),
});

export type TodoCreate = z.infer<typeof todoCreateSchema>;

// =============================================================================
// Todo Update Schema
// =============================================================================

/**
 * Todo 수정 요청 스키마
 *
 * @description
 * PATCH /todos/:id 요청 시 사용되는 스키마입니다.
 * 모든 필드가 선택적(optional)입니다.
 */
export const todoUpdateSchema = z.object({
  title: z
    .string()
    .min(1, '제목은 최소 1자 이상이어야 합니다')
    .max(100, '제목은 100자를 초과할 수 없습니다')
    .optional(),
  content: z.string().max(500, '내용은 500자를 초과할 수 없습니다').optional(),
  completed: z.boolean().optional(),
});

export type TodoUpdate = z.infer<typeof todoUpdateSchema>;

/**
 * API 쿼리 파라미터 스키마 및 타입
 */

import { z } from 'zod';

// =============================================================================
// Pagination Query
// =============================================================================

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1).describe('페이지 번호 (1부터 시작)'),
  size: z.coerce
    .number()
    .int()
    .positive()
    .max(100)
    .default(20)
    .describe('페이지당 항목 수 (최대 100)'),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// =============================================================================
// Sort Query
// =============================================================================

export const sortQuerySchema = z.object({
  sortBy: z.string().optional().describe('정렬 기준 필드'),
  sortOrder: z.enum(['asc', 'desc']).default('asc').describe('정렬 순서 (asc/desc)'),
});

export type SortQuery = z.infer<typeof sortQuerySchema>;

// =============================================================================
// Common Query (Combined)
// =============================================================================

export const commonQuerySchema = paginationQuerySchema.merge(sortQuerySchema);

export type CommonQuery = z.infer<typeof commonQuerySchema>;

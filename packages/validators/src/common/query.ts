/**
 * API 쿼리 파라미터 스키마 및 타입
 */

import { z } from 'zod';

// =============================================================================
// Pagination Query
// =============================================================================

export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type PaginationQuery = z.infer<typeof paginationQuerySchema>;

// =============================================================================
// Sort Query
// =============================================================================

export const sortQuerySchema = z.object({
  sortBy: z.string().optional(),
  sortOrder: z.enum(['asc', 'desc']).default('asc'),
});

export type SortQuery = z.infer<typeof sortQuerySchema>;

// =============================================================================
// Common Query (Combined)
// =============================================================================

export const commonQuerySchema = paginationQuerySchema.merge(sortQuerySchema);

export type CommonQuery = z.infer<typeof commonQuerySchema>;

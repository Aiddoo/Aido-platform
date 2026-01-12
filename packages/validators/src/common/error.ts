/**
 * API 에러 스키마 및 타입
 */

import { z } from 'zod';

// =============================================================================
// Error Detail
// =============================================================================

export const apiErrorDetailSchema = z.object({
  code: z.string(),
  message: z.string(),
  details: z.record(z.string(), z.unknown()).optional(),
});

export type ApiErrorDetail = z.infer<typeof apiErrorDetailSchema>;

// =============================================================================
// API Error Response
// =============================================================================

export const apiErrorSchema = z.object({
  success: z.literal(false),
  error: apiErrorDetailSchema,
  timestamp: z.string().datetime(),
});

export type ApiError = z.infer<typeof apiErrorSchema>;

/**
 * Todo 카테고리 도메인 공통 스키마
 * @description request와 response 양쪽에서 사용되는 공통 스키마 정의
 */
import { z } from 'zod';

// =============================================================================
// 공통 상수
// =============================================================================

/** HEX 색상 코드 검증 */
export const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;

/** 순서 변경 위치 */
export const reorderPositionSchema = z.enum(['before', 'after']).describe('이동 위치');
export type ReorderPosition = z.infer<typeof reorderPositionSchema>;

/**
 * Todo 도메인 공통 스키마
 * @description request와 response 양쪽에서 사용되는 공통 스키마 정의
 * @note 역방향 의존성(response → request) 방지를 위해 분리
 */
import { z } from 'zod';

// =============================================================================
// 공통 스키마
// =============================================================================

/** 공개 범위 */
export const todoVisibilitySchema = z.enum(['PUBLIC', 'PRIVATE']).describe('공개 범위');
export type TodoVisibility = z.infer<typeof todoVisibilitySchema>;

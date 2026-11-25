import { TODO_VISIBILITIES } from '@aido/api/vocabulary';
import { z } from 'zod';

export const todoVisibilitySchema = z.enum(TODO_VISIBILITIES);
export type TodoVisibility = z.infer<typeof todoVisibilitySchema>;

// 할 일·폼·음성 계획이 함께 쓰는 규칙이라 공개 범위 값만 받는다. 정하지 않은(null) 공개 범위는 서버 기본값인 공개로 본다
export function getVisibility(visibility: TodoVisibility | null): TodoVisibility {
  return visibility ?? 'PUBLIC';
}

// 비공개 할 일은 친구에게 보이지 않는다
export function isPrivateVisibility(visibility: TodoVisibility | null): boolean {
  return getVisibility(visibility) === 'PRIVATE';
}

export function getToggledVisibility(visibility: TodoVisibility | null): TodoVisibility {
  return isPrivateVisibility(visibility) ? 'PUBLIC' : 'PRIVATE';
}

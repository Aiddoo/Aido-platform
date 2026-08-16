import { TODO_COMMENT_SORT, type TodoCommentSort } from '@aido/validators';
import { router, useLocalSearchParams } from 'expo-router';
import { z } from 'zod';

/** 서버 계약과 같은 기본값을 쓴다 — 최신순. */
const sortParamSchema = z.enum(TODO_COMMENT_SORT).optional().default(TODO_COMMENT_SORT.LATEST);

/**
 * 정렬은 공유·뒤로가기 대상이자 댓글 쿼리 키라서 URL에 산다.
 * 필요한 컴포넌트가 직접 읽으므로 props로 흘리지 않는다.
 */
export function useCommentSort(): [TodoCommentSort, (sort: TodoCommentSort) => void] {
  const { sort } = useLocalSearchParams<{ sort?: string }>();

  return [sortParamSchema.parse(sort), (next) => router.setParams({ sort: next })];
}

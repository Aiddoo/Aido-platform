import { TODO_COMMENT_SORT, type TodoCommentSort, todoCommentIdSchema } from '@aido/api';
import { z } from 'zod';

const todoCommentRouteSchema = z.object({
  sort: z.enum(TODO_COMMENT_SORT).catch(TODO_COMMENT_SORT.LATEST),
  comment: todoCommentIdSchema.nullable().catch(null),
});

/** 할 일 상세의 URL 상태. 정렬과 알림·링크로 연 댓글 위치만 둔다 */
export interface TodoCommentRoute {
  sort: TodoCommentSort;
  comment: string | null;
}

export interface TodoCommentRouteParams {
  [key: string]: string | undefined;
  sort: TodoCommentSort;
  comment: string | undefined;
}

export function parseTodoCommentRoute(params: { sort?: unknown; comment?: unknown }) {
  return todoCommentRouteSchema.parse({
    sort: params.sort ?? TODO_COMMENT_SORT.LATEST,
    comment: params.comment ?? null,
  });
}

export function serializeTodoCommentRoute(route: TodoCommentRoute): TodoCommentRouteParams {
  return { sort: route.sort, comment: route.comment ?? undefined };
}

/** 1.14.0 이하 대화 링크(`/todo/42/comments/cm_1`)와 알림이 여는 할 일 상세 */
export function createTodoCommentHref({
  todoId,
  commentId,
}: {
  todoId: number;
  commentId: string;
}) {
  return { pathname: '/todo/[todoId]', params: { todoId, comment: commentId } } as const;
}

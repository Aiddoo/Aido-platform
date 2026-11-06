import { todoCommentIdSchema } from '@aido/api';
import { todoScreenParamsSchema } from '@src/features/planning/todo/schemas/todo-params.schema';
import { Redirect, useLocalSearchParams } from 'expo-router';

const legacyTodoCommentThreadParamsSchema = todoScreenParamsSchema.extend({
  commentId: todoCommentIdSchema,
});

/** 1.14.0 이하 대화 링크. 할 일 상세 한 화면의 그 댓글 위치로 옮긴다 */
export default function LegacyTodoCommentThreadRoute() {
  const params = legacyTodoCommentThreadParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return (
    <Redirect
      href={{
        pathname: '/todo/[todoId]',
        params: { todoId: params.data.todoId, comment: params.data.commentId },
      }}
    />
  );
}

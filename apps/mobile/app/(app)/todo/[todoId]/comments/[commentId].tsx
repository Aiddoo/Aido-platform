import { todoCommentIdSchema } from '@aido/api';
import { TodoDetailPane } from '@src/features/todo-comment/components/todo-detail-pane/todo-detail-pane';
import { todoScreenParamsSchema } from '@src/features/todo/hooks/use-todo-screen-params';
import { Redirect, useLocalSearchParams } from 'expo-router';

const todoCommentThreadScreenParamsSchema = todoScreenParamsSchema.extend({
  commentId: todoCommentIdSchema,
});

/** 댓글 개요에서 한 단계 push한 대화 화면. 뒤로가기는 Stack pop으로 개요의 스크롤 위치로 돌아간다. */
export default function TodoCommentThreadRoute() {
  const params = todoCommentThreadScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return <TodoDetailPane presentation="screen" />;
}

import { TodoDetailPane } from '@src/features/todo-comment/components/todo-detail-pane/todo-detail-pane';
import { todoScreenParamsSchema } from '@src/features/todo/hooks/use-todo-screen-params';
import { Redirect, useLocalSearchParams } from 'expo-router';

export default function TodoDetailRoute() {
  const params = todoScreenParamsSchema.safeParse(useLocalSearchParams());

  if (!params.success) {
    return <Redirect href="/feed" />;
  }

  return <TodoDetailPane presentation="screen" />;
}

import { TodoDetailPane } from '@src/features/todo-comment/components/todo-detail-pane/todo-detail-pane';

import { useFeedSelectedTodo } from '../hooks/use-feed-selected-todo';

export function FeedTodoDetailPane() {
  const [selectedTodoId] = useFeedSelectedTodo();

  if (selectedTodoId == null) {
    return <FeedTodoDetailPane.Empty />;
  }

  return <FeedTodoDetailPane.Contents todoId={selectedTodoId} />;
}

FeedTodoDetailPane.Contents = function Contents({ todoId }: { todoId: number }) {
  return <TodoDetailPane key={todoId} presentation="pane" />;
};

FeedTodoDetailPane.Empty = TodoDetailPane.Empty;

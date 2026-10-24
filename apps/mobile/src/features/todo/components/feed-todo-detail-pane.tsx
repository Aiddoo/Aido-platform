import { TodoDetailPane } from '@src/features/todo-comment/components/todo-detail-pane/todo-detail-pane';

import { useFeedSelectedTodo } from '../hooks/use-feed-selected-todo';

/** 펼친 피드의 상세 pane. 선택된 할 일이 바뀌면 상세를 새로 마운트한다. */
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

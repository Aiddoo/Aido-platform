import { createContext, type PropsWithChildren, use } from 'react';
import { type UseFormReturn } from 'react-hook-form';

import { type TodoCommentFormValues } from '../schemas/todo-comment-form.schema';

type TodoCommentFormContextValue = UseFormReturn<TodoCommentFormValues>;

const TodoCommentFormContext = createContext<TodoCommentFormContextValue | null>(null);

/** 작성 바, 댓글 행, 뒤로 가기가 같은 입력값을 읽고 바꾸므로 세션이 소유한 폼을 그 아래에 나눠 준다 */
export function TodoCommentFormProvider({
  form,
  children,
}: PropsWithChildren<{ form: TodoCommentFormContextValue }>) {
  return <TodoCommentFormContext value={form}>{children}</TodoCommentFormContext>;
}

export function useTodoCommentForm() {
  const form = use(TodoCommentFormContext);
  if (form == null) {
    throw new Error('useTodoCommentForm must be used inside TodoCommentFormProvider');
  }

  return form;
}

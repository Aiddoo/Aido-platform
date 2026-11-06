import { useUpdateTodoScheduleMutationOptions } from '@src/features/planning/todo/queries/todo.mutations';
import { mutationOptions } from '@tanstack/react-query';

/**
 * 할 일 일정 수정 요청만 그대로 쓴다. 여러 할 일을 한 번에 옮기므로 할 일마다 뜨는 저장 토스트·실패 토스트와
 * 캐시 무효화는 빼고, 호출하는 쪽이 한 번만 알리고 한 번만 무효화한다.
 * 오프라인에서 요청이 멈추면 시트가 닫히지 않으므로 바로 실패시킨다.
 */
export const useRescheduleTodoMutationOptions = () => {
  const { mutationFn } = useUpdateTodoScheduleMutationOptions();

  return mutationOptions({ networkMode: 'always', mutationFn });
};

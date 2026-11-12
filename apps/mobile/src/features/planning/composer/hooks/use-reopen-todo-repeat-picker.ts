import { withScheduleRepeat } from '@src/features/planning/todo/domains/todo.model';
import { useOpenTodoRepeatPicker } from '@src/features/planning/todo/hooks/use-open-todo-repeat-picker';
import type { TodoFormValues } from '@src/features/planning/todo/schemas/todo-form.schema';
import type { UseFormReturn } from 'react-hook-form';

import { useFocusTodoTitle } from './use-focus-todo-title';

/** 저장이 반복 때문에 거절됐을 때 제출 함수가 반복 시트를 다시 연다 */
export function useReopenTodoRepeatPicker(
  form: Pick<UseFormReturn<TodoFormValues>, 'getValues' | 'setFocus' | 'setValue'>,
) {
  const openRepeatPicker = useOpenTodoRepeatPicker();
  const focusTitle = useFocusTodoTitle(form);

  return async () => {
    const values = form.getValues();
    const next = await openRepeatPicker(values, { onCloseStart: focusTitle });
    if (next == null) {
      return;
    }
    const { startDate, endDate, repeat } = withScheduleRepeat(values, next);
    form.setValue('startDate', startDate, { shouldDirty: true });
    form.setValue('endDate', endDate, { shouldDirty: true });
    form.setValue('repeat', repeat, { shouldDirty: true });
  };
}

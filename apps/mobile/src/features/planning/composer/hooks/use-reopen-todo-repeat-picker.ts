import { TodoSchedulePolicy } from '@src/features/planning/todo/domains/todo-schedule.model';
import { useOpenTodoRepeatPicker } from '@src/features/planning/todo/hooks/use-open-todo-repeat-picker';
import type { TodoFormValues } from '@src/features/planning/todo/schemas/todo-form.schema';
import type { UseFormGetValues, UseFormSetValue } from 'react-hook-form';

interface ReopenTodoRepeatPickerOptions {
  getValues: UseFormGetValues<TodoFormValues>;
  setValue: UseFormSetValue<TodoFormValues>;
  /** 반복 시트가 닫히기 시작할 때 부른다. 제목 칸으로 포커스를 돌려준다 */
  focusTitle: () => void;
}

/** 저장이 반복 때문에 거절됐을 때 제출 함수가 반복 시트를 다시 연다 */
export function useReopenTodoRepeatPicker({
  getValues,
  setValue,
  focusTitle,
}: ReopenTodoRepeatPickerOptions) {
  const openRepeatPicker = useOpenTodoRepeatPicker();

  return async () => {
    const values = getValues();
    const next = await openRepeatPicker(values, { onCloseStart: focusTitle });
    if (next == null) {
      return;
    }
    const { startDate, endDate, repeat } = TodoSchedulePolicy.withRepeat(values, next);
    setValue('startDate', startDate, { shouldDirty: true });
    setValue('endDate', endDate, { shouldDirty: true });
    setValue('repeat', repeat, { shouldDirty: true });
  };
}

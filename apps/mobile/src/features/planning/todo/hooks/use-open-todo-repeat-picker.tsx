import { useOpenSheet } from '@src/shared/ui';

import { TodoRepeatPicker } from '../components/todo-repeat-picker';
import type { TodoSchedule } from '../domains/todo.model';

export interface SheetOptions {
  /** 시트가 닫히기 시작할 때. 작성 시트는 여기서 제목 칸으로 키보드를 돌린다 */
  onCloseStart?: () => void;
}

/** 반복 고르기 시트. 저장이 반복 때문에 거절되면 제출하는 쪽도 다시 연다. 값 없이 닫히면 undefined다 */
export function useOpenTodoRepeatPicker() {
  const openSheet = useOpenSheet();

  return (value: TodoSchedule, sheetOptions: SheetOptions = {}) =>
    openSheet<Pick<TodoSchedule, 'startDate' | 'repeat'>>(
      (close) => (
        <TodoRepeatPicker
          value={{ startDate: value.startDate, repeat: value.repeat }}
          onChange={close}
          onCancel={() => close()}
        />
      ),
      { ...sheetOptions, hasFixedHeader: true },
    );
}

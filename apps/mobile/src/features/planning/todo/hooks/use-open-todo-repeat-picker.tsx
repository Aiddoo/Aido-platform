import { toLocalDayInstant } from '@src/shared/date/native-date';
import { toDateKey } from '@src/shared/date/zoned';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
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
  const { timeZone } = useDateFormatContext();

  return (value: TodoSchedule, sheetOptions: SheetOptions = {}) =>
    openSheet<Pick<TodoSchedule, 'startDate' | 'repeat'>>(
      (close) => (
        // 피커가 아직 그날 0시 순간을 주고받아 이 경계에서만 날짜 key와 바꾼다
        <TodoRepeatPicker
          value={{ startDate: toLocalDayInstant(value.startDate), repeat: value.repeat }}
          onChange={(next) =>
            close({ startDate: toDateKey(next.startDate, timeZone), repeat: next.repeat })
          }
          onCancel={() => close()}
        />
      ),
      { ...sheetOptions, hasFixedHeader: true },
    );
}

import { USER_PREFERENCE_DEFAULTS } from '@aido/api/vocabulary';
import { useGetPreferenceQueryOptions } from '@src/features/identity/preference/queries/preference.queries';
import { TodoRow } from '@src/features/planning/todo/components/todo-row';
import { isPrivateVisibility, type Todo } from '@src/features/planning/todo/domains/todo.model';
import { formatTimeOfDay } from '@src/shared/date/format/date-format';
import { toTimeOfDay } from '@src/shared/date/time-of-day';
import { useDateFormatContext } from '@src/shared/hooks/use-date-format-context';
import { getTouchTargetInset } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import type { ComponentProps } from 'react';

/** 목록 줄의 체크 칸(`Checkbox`의 size-5) */
const CHECKBOX_SIZE_PT = 20;
const CHECKBOX_HIT_SLOP = getTouchTargetInset(CHECKBOX_SIZE_PT);

type DemoTodo = Pick<Todo, 'title' | 'visibility' | 'localTime'>;

interface DemoTodoRowProps extends Omit<
  ComponentProps<typeof TodoRow>,
  'left' | 'top' | 'middle' | 'bottom'
> {
  todo: DemoTodo;
  /** 목록처럼 체크가 "끝냄"이라 줄을 긋는다 */
  isSelected: boolean;
  onSelectedChange: (isSelected: boolean) => void;
}

/** 할 일 목록 줄을 저장 없이 예시 값으로 그린다 */
export function DemoTodoRow({ todo, isSelected, onSelectedChange, ...rowProps }: DemoTodoRowProps) {
  const dateFormatContext = useDateFormatContext();
  // 예시라 설정을 받기까지 기다리지 않고 기본 표기로 먼저 보인다
  const { data: preference } = useQuery(useGetPreferenceQueryOptions());

  const timeFormat = preference?.timeFormat ?? USER_PREFERENCE_DEFAULTS.TIME_FORMAT;
  const timeLabel =
    todo.localTime == null
      ? null
      : formatTimeOfDay(toTimeOfDay(todo.localTime), timeFormat, dateFormatContext);

  return (
    <TodoRow
      {...rowProps}
      left={
        <TodoRow.Checkbox
          accessibilityLabel={todo.title}
          hitSlop={CHECKBOX_HIT_SLOP}
          isSelected={isSelected}
          onSelectedChange={onSelectedChange}
        />
      }
      top={
        <TodoRow.TitleLine
          label={
            <TodoRow.Label isCompleted={isSelected} className="flex-1">
              {todo.title}
            </TodoRow.Label>
          }
          isPrivate={isPrivateVisibility(todo.visibility)}
        />
      }
      middle={
        timeLabel == null ? undefined : (
          <TodoRow.ScheduleLine repeat={null} isRepeating={false} timeLabel={timeLabel} />
        )
      }
    />
  );
}

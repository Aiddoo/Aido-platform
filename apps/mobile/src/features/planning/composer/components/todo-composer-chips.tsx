import { TodoTimePushNotice } from '@src/features/notification/components/todo-time-push-notice';
import { useAskPushPermissionOnTodoTime } from '@src/features/notification/hooks/use-ask-push-permission-on-todo-time';
import {
  TodoScheduleChips,
  type TodoScheduleChipsValue,
} from '@src/features/planning/todo/components/todo-schedule-chips';
import {
  getScheduledTime,
  hasScheduleChanged,
} from '@src/features/planning/todo/domains/todo.model';
import type { TodoFormValues } from '@src/features/planning/todo/schemas/todo-form.schema';
import { VStack } from '@src/shared/ui';
import type { ComponentProps } from 'react';
import { type UseFormReturn, useWatch } from 'react-hook-form';

import { useFocusTodoTitle } from '../hooks/use-focus-todo-title';

type ComposerForm = UseFormReturn<TodoFormValues>;

const SCHEDULE_FIELDS = [
  'startDate',
  'endDate',
  'scheduledTime',
  'isAllDay',
  'repeat',
  'visibility',
  'categoryId',
] as const;

interface TodoComposerChipsProps extends Omit<
  ComponentProps<typeof TodoScheduleChips>,
  'value' | 'onChange' | 'onPickerCloseStart'
> {
  form: ComposerForm;
}

/** 할 일을 만들고 고치는 시트의 일정 칩 줄. 시트가 가진 폼의 일정 칸을 칩에 잇고, 시간을 정하면 알림 권한을 묻는다 */
export function TodoComposerChips({ form, ...chipsProps }: TodoComposerChipsProps) {
  const askPushPermission = useAskPushPermissionOnTodoTime();
  const focusTitle = useFocusTodoTitle(form);
  const [startDate, endDate, scheduledTime, isAllDay, repeat, visibility, categoryId] = useWatch({
    control: form.control,
    name: SCHEDULE_FIELDS,
  });

  const schedule = { startDate, endDate, scheduledTime, isAllDay, repeat, visibility, categoryId };

  const handleChange = (next: TodoScheduleChipsValue) => {
    setScheduleFields(form, next);
    if (hasScheduleChanged(next, schedule) && getScheduledTime(next) != null) {
      askPushPermission();
    }
  };

  return (
    <VStack gap={8}>
      <TodoScheduleChips
        {...chipsProps}
        value={schedule}
        onChange={handleChange}
        onPickerCloseStart={focusTitle}
      />
      <TodoTimePushNotice isTimed={getScheduledTime(schedule) != null} />
    </VStack>
  );
}

function setScheduleFields(
  { setValue }: Pick<ComposerForm, 'setValue'>,
  next: TodoScheduleChipsValue,
) {
  setValue('startDate', next.startDate);
  setValue('endDate', next.endDate);
  setValue('scheduledTime', next.scheduledTime);
  setValue('isAllDay', next.isAllDay);
  setValue('repeat', next.repeat);
  setValue('visibility', next.visibility);
  setValue('categoryId', next.categoryId);
}

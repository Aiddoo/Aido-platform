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

// 시간을 정하면 알림 권한을 묻는다
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

// 고친 칸으로 표시해 수정 폼이 다시 받은 할 일로 맞출 때 덮지 않게 한다
function setScheduleFields(
  { setValue }: Pick<ComposerForm, 'setValue'>,
  next: TodoScheduleChipsValue,
) {
  const options = { shouldDirty: true };
  setValue('startDate', next.startDate, options);
  setValue('endDate', next.endDate, options);
  setValue('scheduledTime', next.scheduledTime, options);
  setValue('isAllDay', next.isAllDay, options);
  setValue('repeat', next.repeat, options);
  setValue('visibility', next.visibility, options);
  setValue('categoryId', next.categoryId, options);
}

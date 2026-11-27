import { TodoTimePushNotice } from '@src/features/notification/components/todo-time-push-notice';
import { useAskPushPermissionOnTodoTime } from '@src/features/notification/hooks/use-ask-push-permission-on-todo-time';
import {
  TodoScheduleChips,
  type TodoScheduleChipsValue,
} from '@src/features/planning/todo/components/todo-schedule-chips';
import { TodoSchedulePolicy } from '@src/features/planning/todo/domains/todo-schedule.model';
import type { TodoFormValues } from '@src/features/planning/todo/schemas/todo-form.schema';
import { VStack } from '@src/shared/ui';
import type { ComponentProps } from 'react';
import type { UseFormSetValue } from 'react-hook-form';

// 제목을 뺀 할 일 폼의 모든 칸이다. 칩 줄 값과 같은 순서로 읽는다
export const TODO_COMPOSER_CHIP_FIELDS = [
  'startDate',
  'endDate',
  'scheduledTime',
  'isAllDay',
  'repeat',
  'visibility',
  'categoryId',
] as const;

type TodoComposerChipsProps = ComponentProps<typeof TodoScheduleChips>;

// 시간을 정하면 알림 권한을 묻는다
export function TodoComposerChips({ value, onChange, ...props }: TodoComposerChipsProps) {
  const askPushPermission = useAskPushPermissionOnTodoTime();

  const handleChange = (next: TodoScheduleChipsValue) => {
    onChange(next);
    if (
      TodoSchedulePolicy.hasTimeChanged(next, value) &&
      TodoSchedulePolicy.findScheduledTime(next) != null
    ) {
      askPushPermission();
    }
  };

  return (
    <VStack gap={8}>
      <TodoScheduleChips {...props} value={value} onChange={handleChange} />
      <TodoTimePushNotice isTimed={TodoSchedulePolicy.findScheduledTime(value) != null} />
    </VStack>
  );
}

// 칩 하나가 여러 칸을 함께 바꾼다(날짜를 옮기면 반복 끝도). 고친 칸으로 표시해 수정 폼이 다시 받은 할 일로 맞출 때 덮지 않게 한다
export function setTodoComposerChipFields(
  setValue: UseFormSetValue<TodoFormValues>,
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

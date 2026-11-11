import { TodoTimePushNotice } from '@src/features/notification/components/todo-time-push-notice';
import { useAskPushPermissionOnTodoTime } from '@src/features/notification/hooks/use-ask-push-permission-on-todo-time';
import {
  TodoScheduleChips,
  type TodoScheduleChipsValue,
} from '@src/features/planning/todo/components/todo-schedule-chips';
import {
  getScheduledTime,
  hasScheduleChanged,
  withScheduleRepeat,
} from '@src/features/planning/todo/domains/todo.model';
import { useOpenTodoRepeatPicker } from '@src/features/planning/todo/hooks/use-open-todo-repeat-picker';
import type { TodoFormValues } from '@src/features/planning/todo/schemas/todo-form.schema';
import { useFontScaledSize } from '@src/shared/hooks/use-font-scaled-size';
import { useTranslation } from '@src/shared/i18n';
import { ArrowUpIcon, VStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback, Spinner } from 'heroui-native';
import type { ComponentProps } from 'react';
import { type UseFormReturn, useWatch } from 'react-hook-form';
import { useResolveClassNames } from 'uniwind';

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
        onPickerCloseStart={() => focusTitle(form)}
      />
      <TodoTimePushNotice isTimed={getScheduledTime(schedule) != null} />
    </VStack>
  );
}

/** 저장이 반복 때문에 거절됐을 때 제출 함수가 반복 시트를 다시 연다 */
export function useReopenTodoRepeatPicker(
  form: Pick<ComposerForm, 'getValues' | 'setFocus' | 'setValue'>,
) {
  const openRepeatPicker = useOpenTodoRepeatPicker();

  return async () => {
    const values = form.getValues();
    const next = await openRepeatPicker(values, { onCloseStart: () => focusTitle(form) });
    if (next != null) {
      setScheduleFields(form, { ...values, ...withScheduleRepeat(values, next) });
    }
  };
}

interface TodoComposerSubmitButtonProps extends Pick<
  ComponentProps<typeof PressableFeedback>,
  'isDisabled' | 'onPress' | 'testID'
> {
  isSubmitting: boolean;
}

export function TodoComposerSubmitButton({
  isDisabled,
  isSubmitting,
  onPress,
  testID,
}: TodoComposerSubmitButtonProps) {
  const { t } = useTranslation('todo');
  const fontScaledSize = useFontScaledSize();
  const { color: spinnerColor } = useResolveClassNames('text-white');

  return (
    <PressableFeedback
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={t('add.save')}
      accessibilityState={{ disabled: isDisabled === true, busy: isSubmitting }}
      isDisabled={isDisabled}
      onPress={onPress}
      style={{ width: fontScaledSize(36), height: fontScaledSize(36) }}
      className={cn(
        'items-center justify-center rounded-4xl',
        isDisabled ? 'bg-gray-3' : 'bg-main',
      )}
    >
      {isSubmitting ? (
        <Spinner size="sm" color={typeof spinnerColor === 'string' ? spinnerColor : undefined} />
      ) : (
        <ArrowUpIcon
          width={fontScaledSize(18)}
          height={fontScaledSize(18)}
          colorClassName="text-white"
        />
      )}
    </PressableFeedback>
  );
}

// 고르기 시트가 닫히는 애니메이션과 겹치면 키보드가 올라오다 멈춰 다음 프레임에 포커스한다
function focusTitle(form: Pick<ComposerForm, 'setFocus'>) {
  requestAnimationFrame(() => form.setFocus('title'));
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

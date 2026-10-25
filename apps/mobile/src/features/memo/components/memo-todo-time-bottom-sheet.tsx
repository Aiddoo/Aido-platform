import { TodoTimePickerContent } from '@src/features/todo/components/todo-time-picker-content';
import { ModalBottomSheet } from '@src/shared/ui';
import type { ComponentProps } from 'react';
import { Suspense } from 'react';
import { ActivityIndicator } from 'react-native';

type MemoTodoTimeBottomSheetProps = Omit<ComponentProps<typeof ModalBottomSheet>, 'children'> &
  Pick<ComponentProps<typeof TodoTimePickerContent>, 'date' | 'value' | 'onChange' | 'onCancel'>;

export function MemoTodoTimeBottomSheet({
  date,
  value,
  onChange,
  onCancel,
  ...props
}: MemoTodoTimeBottomSheetProps) {
  return (
    <ModalBottomSheet {...props}>
      <Suspense fallback={<ActivityIndicator />}>
        <TodoTimePickerContent date={date} value={value} onChange={onChange} onCancel={onCancel} />
      </Suspense>
    </ModalBottomSheet>
  );
}

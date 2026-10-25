import { TodoDatePickerContent } from '@src/features/todo/components/todo-date-picker-content';
import { ModalBottomSheet } from '@src/shared/ui';
import type { ComponentProps } from 'react';

type MemoTodoDateBottomSheetProps = Omit<ComponentProps<typeof ModalBottomSheet>, 'children'> &
  Pick<ComponentProps<typeof TodoDatePickerContent>, 'value' | 'onChange' | 'onCancel'>;

export function MemoTodoDateBottomSheet({
  value,
  onChange,
  onCancel,
  ...props
}: MemoTodoDateBottomSheetProps) {
  return (
    <ModalBottomSheet {...props}>
      <TodoDatePickerContent value={value} onChange={onChange} onCancel={onCancel} />
    </ModalBottomSheet>
  );
}

import { KeyboardBottomSheet } from '@src/shared/ui/BottomSheet';
import type { TodoItemViewModel } from '../view-models/todo-item.view-model';
import {
  TodoDateTimeEditorContent,
  type TodoDateTimeEditorValue,
} from './TodoDateTimeEditorContent';

interface TodoDateTimeBottomSheetProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onRequestClose: () => void;
  todo: TodoItemViewModel;
  onConfirm: (value: TodoDateTimeEditorValue) => void;
}

export const TodoDateTimeBottomSheet = ({
  isOpen,
  onOpenChange,
  onRequestClose,
  todo,
  onConfirm,
}: TodoDateTimeBottomSheetProps) => {
  return (
    <KeyboardBottomSheet isOpen={isOpen} onOpenChange={onOpenChange}>
      {isOpen && (
        <TodoDateTimeEditorContent
          initialValue={{
            startDate: todo.startDateObj,
            endDate: todo.endDateObj,
            scheduledTime: todo.scheduledTime24,
            isAllDay: todo.isAllDay,
          }}
          onCancel={onRequestClose}
          onConfirm={(value) => {
            onConfirm(value);
            onRequestClose();
          }}
        />
      )}
    </KeyboardBottomSheet>
  );
};

import { ModalBottomSheet, useOverlay } from '@src/shared/ui';

import { TodoScopeSelectContent } from '../components/todo-scope-select-content';
import type { TodoEditScope } from '../domains/todo-repeat.model';

/** 반복 할 일을 고치거나 지울 때 범위를 묻는다. 시트를 그냥 닫으면 null이다. */
export function useSelectTodoScope() {
  const overlay = useOverlay();

  const selectScope = (action: 'edit' | 'delete') =>
    overlay.open<TodoEditScope | null>(({ isOpen, close, exit }) => (
      <ModalBottomSheet isOpen={isOpen} onOpenChange={() => close(null)} onExit={exit}>
        <TodoScopeSelectContent action={action} onChange={close} />
      </ModalBottomSheet>
    ));

  return {
    selectEditScope: () => selectScope('edit'),
    selectDeleteScope: () => selectScope('delete'),
  };
}

import { useEntitlementGate } from '@src/features/billing/subscription/hooks/use-entitlement-gate';
import { useOpenKeyboardSheet } from '@src/shared/ui';

import {
  NudgeBottomSheet,
  type NudgeReceiver,
  type NudgeTargetTodo,
} from '../components/nudge-bottom-sheet';

/** 할 일 콕 시트를 연다. 줄의 콕 버튼과 행 메뉴가 같은 한도 안내와 시트를 쓰게 한 곳에서 조립한다 */
export function useOpenTodoNudge() {
  const openKeyboardSheet = useOpenKeyboardSheet();
  const gate = useEntitlementGate('NUDGE', { surface: 'todo_nudge' });

  return ({ receiver, todo }: { receiver: NudgeReceiver; todo: NudgeTargetTodo }) => {
    if (gate.promptIfBlocked()) {
      return;
    }
    openKeyboardSheet(({ isOpen, onOpenChange }) => (
      <NudgeBottomSheet
        receiver={receiver}
        todo={todo}
        isOpen={isOpen}
        onOpenChange={onOpenChange}
      />
    ));
  };
}

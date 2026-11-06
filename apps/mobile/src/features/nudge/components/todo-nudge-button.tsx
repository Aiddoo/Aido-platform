import { useEntitlementGate } from '@src/features/subscription/hooks/use-entitlement-gate';
import { useOverlay } from '@src/shared/ui';
import type { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

import { NudgeBottomSheet, type NudgeReceiver, type NudgeTargetTodo } from './nudge-bottom-sheet';
import { NudgePawButton } from './nudge-paw-button';

interface TodoNudgeButtonProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'onPress'
> {
  receiver: NudgeReceiver;
  todo: NudgeTargetTodo;
}

/** 친구 할 일 목록과 상세가 공유하는 넛지 진입점. 시트와 한도 UX도 이곳에서 한 번만 조립한다. */
export function TodoNudgeButton({
  receiver,
  todo,
  isDisabled,
  ...pressableProps
}: TodoNudgeButtonProps) {
  const overlay = useOverlay();
  const gate = useEntitlementGate('NUDGE', { surface: 'todo_nudge' });

  const openNudgeSheet = () => {
    overlay.open(({ isOpen, close, unmount }) => (
      <NudgeBottomSheet
        receiver={receiver}
        todo={todo}
        isOpen={isOpen}
        onOpenChange={(open) => {
          if (!open) {
            close();
            unmount();
          }
        }}
      />
    ));
  };

  const handlePress = () => {
    if (!gate.guard()) {
      return;
    }

    openNudgeSheet();
  };

  return <NudgePawButton {...pressableProps} onPress={handlePress} isDisabled={isDisabled} />;
}

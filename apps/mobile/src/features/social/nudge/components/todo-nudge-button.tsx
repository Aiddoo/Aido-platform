import type { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

import { useOpenTodoNudge } from '../hooks/use-open-todo-nudge';
import type { NudgeReceiver, NudgeTargetTodo } from './nudge-bottom-sheet';
import { NudgePawButton } from './nudge-paw-button';

interface TodoNudgeButtonProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'onPress'
> {
  receiver: NudgeReceiver;
  todo: NudgeTargetTodo;
}

/** 친구 할 일 목록과 상세가 공유하는 콕 버튼 */
export function TodoNudgeButton({
  receiver,
  todo,
  isDisabled,
  ...pressableProps
}: TodoNudgeButtonProps) {
  const openTodoNudge = useOpenTodoNudge();

  return (
    <NudgePawButton
      {...pressableProps}
      onPress={() => openTodoNudge({ receiver, todo })}
      isDisabled={isDisabled}
    />
  );
}

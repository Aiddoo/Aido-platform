import type { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

import { useOpenTodoNudge } from '../hooks/use-open-todo-nudge';
import type { NudgeReceiver, NudgeTargetTodo } from './nudge-bottom-sheet';
import { NudgePawButton } from './nudge-paw-button';

interface TodoNudgeButtonProps extends Omit<ComponentProps<typeof PressableFeedback>, 'children'> {
  receiver: NudgeReceiver;
  todo: NudgeTargetTodo;
}

export function TodoNudgeButton({
  receiver,
  todo,
  isDisabled,
  onPress,
  ...pressableProps
}: TodoNudgeButtonProps) {
  const openTodoNudge = useOpenTodoNudge();

  return (
    <NudgePawButton
      {...pressableProps}
      onPress={(event) => {
        openTodoNudge({ receiver, todo });
        // asChild 트리거·코치마크가 자식에 넣은 onPress를 이어 불러 그 누름이 사라지지 않게 한다
        if (typeof onPress === 'function') {
          onPress(event);
        }
      }}
      isDisabled={isDisabled}
    />
  );
}

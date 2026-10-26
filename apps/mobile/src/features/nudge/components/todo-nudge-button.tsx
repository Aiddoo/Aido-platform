import { useTrack } from '@src/shared/analytics';
import { useTranslation } from '@src/shared/i18n';
import { useOverlay, usePremiumDialog } from '@src/shared/ui';
import { useQuery } from '@tanstack/react-query';
import type { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

import { TodoNudgePolicy } from '../domains/todo-nudge.model';
import { useGetTodoNudgeLimitQueryOptions } from '../queries/get-todo-nudge-limit-query-options';
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
  const { t } = useTranslation('todo');
  const { trackEvent } = useTrack();
  const overlay = useOverlay();
  const premiumDialog = usePremiumDialog();
  const limitQuery = useQuery(useGetTodoNudgeLimitQueryOptions());
  const isLimitReached = limitQuery.data != null && TodoNudgePolicy.isLimitReached(limitQuery.data);
  const isUnavailable = isDisabled || limitQuery.isPending;

  const openNudgeSheet = () => {
    overlay
      .open(({ isOpen, close, exit }) => (
        <NudgeBottomSheet
          receiver={receiver}
          todo={todo}
          isOpen={isOpen}
          onOpenChange={(open) => {
            if (!open) {
              close();
              exit();
            }
          }}
        />
      ))
      .catch(() => undefined);
  };

  const handlePress = () => {
    if (isLimitReached) {
      trackEvent('premium_gate_shown', { feature: 'friend_todo_view' });
      premiumDialog.open({
        title: t('nudge.limitTitle'),
        description: t('nudge.subscribeUnlimited'),
      });
      return;
    }

    openNudgeSheet();
  };

  return <NudgePawButton {...pressableProps} onPress={handlePress} isDisabled={isUnavailable} />;
}

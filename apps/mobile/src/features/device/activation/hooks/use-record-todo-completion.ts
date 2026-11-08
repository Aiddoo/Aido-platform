import { useActivationService } from '@src/bootstrap/providers/di-context';
import { subscribeTodoCompletionChanged } from '@src/core/events/todo-completion-changed';
import { useTrack } from '@src/shared/analytics';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { recordTodoCompletionForActivation } from '../queries/activation-cache';

/** 할 일 완료를 활성화 진행에 기록한다. 로그인한 화면 묶음에 한 번 둔다 */
export function useRecordTodoCompletion() {
  const queryClient = useQueryClient();
  const activationService = useActivationService();
  const { trackEvent } = useTrack();

  useEffect(
    () =>
      subscribeTodoCompletionChanged(({ isCompleted }) => {
        const activationEvent = recordTodoCompletionForActivation({
          queryClient,
          service: activationService,
          isCompleted,
        });
        if (activationEvent) {
          trackEvent('activation_completed', activationEvent);
        }
      }),
    [activationService, queryClient, trackEvent],
  );
}

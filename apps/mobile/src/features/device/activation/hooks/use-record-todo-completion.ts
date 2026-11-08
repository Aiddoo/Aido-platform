import { useActivationService } from '@src/bootstrap/providers/di-context';
import { subscribeTodoCompletionChanged } from '@src/core/events/todo-completion-changed';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/instant';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getCachedActivationContext } from '../queries/activation-cache';

export function useRecordTodoCompletion() {
  const queryClient = useQueryClient();
  const activationService = useActivationService();
  const { trackEvent } = useTrack();

  useEffect(
    () =>
      subscribeTodoCompletionChanged(({ isCompleted }) => {
        const activation = activationService.recordTodoCompletion({
          ...getCachedActivationContext(queryClient),
          isCompleted,
          now: getNowInstant(),
        });
        if (activation.event) {
          trackEvent('activation_completed', activation.event);
        }
      }),
    [activationService, queryClient, trackEvent],
  );
}

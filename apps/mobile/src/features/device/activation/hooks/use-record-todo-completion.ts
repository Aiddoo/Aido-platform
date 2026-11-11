import { useActivationService } from '@src/bootstrap/providers/di-context';
import { subscribeTodoCompletionChanged } from '@src/core/events/todo-completion-changed';
import { useTrack } from '@src/shared/analytics';
import { getNowInstant } from '@src/shared/date/clock';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getCachedActivationContext } from '../queries/activation-cache';

// 로그인한 화면 묶음에 한 번만 둔다
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
        if (activation.status === 'activated') {
          trackEvent('activation_completed', { days_since_signup: activation.daysSinceSignup });
        }
      }),
    [activationService, queryClient, trackEvent],
  );
}

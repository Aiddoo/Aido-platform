import { useActivationService } from '@src/bootstrap/providers/di-context';
import { subscribeTodoCreated } from '@src/core/events/todo-created';
import { getNowInstant } from '@src/shared/date/instant';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';

import { getCachedActivationContext } from '../queries/activation-cache';

// 로그인한 화면 묶음에 한 번만 둔다
export function useRecordTodoCreated() {
  const queryClient = useQueryClient();
  const activationService = useActivationService();

  useEffect(
    () =>
      subscribeTodoCreated(() => {
        activationService.recordTodoCreated({
          ...getCachedActivationContext(queryClient),
          now: getNowInstant(),
        });
      }),
    [activationService, queryClient],
  );
}

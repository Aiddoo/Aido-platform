import { useMutationErrorFeedback } from '@src/shared/query/use-mutation-error-feedback';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';

import {
  type MutationErrorFeedbackEvent,
  subscribeMutationErrorFeedback,
} from './mutation-error-feedback-cache';

/** 토스트와 햅틱이 DI·UI Provider 안의 훅이라 캐시가 아니라 Provider 트리에 한 번 둔다 */
export function MutationErrorFeedback() {
  const queryClient = useQueryClient();
  const showMutationError = useMutationErrorFeedback();

  const showFeedback = useEffectEvent(
    ({ error, feedback: { feature, fallbackKey, describe } }: MutationErrorFeedbackEvent) => {
      showMutationError(error, { feature, fallbackKey, description: describe?.(error) });
    },
  );

  useEffect(
    () =>
      subscribeMutationErrorFeedback(queryClient.getMutationCache(), (event) => {
        showFeedback(event);
      }),
    [queryClient],
  );

  return null;
}

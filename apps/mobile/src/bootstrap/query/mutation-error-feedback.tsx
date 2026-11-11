import { useErrorReporter, useHaptics } from '@src/bootstrap/providers/di-context';
import {
  getErrorReportTags,
  getUserFacingMessage,
  isUnexpectedError,
  toError,
} from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useEffectEvent } from 'react';

import {
  type MutationErrorFeedbackEvent,
  subscribeMutationErrorFeedback,
} from './mutation-error-feedback-cache';

/**
 * mutation 실패를 `meta.errorFeedback`대로 햅틱·토스트 한 번으로 알리고 예측하지 못한 것만 보고한다.
 * 토스트와 햅틱이 DI·UI Provider 안의 훅이라 캐시가 아니라 Provider 트리에 한 번 둔다
 */
export function MutationErrorFeedback() {
  const queryClient = useQueryClient();
  const haptics = useHaptics();
  const toast = useAppToast();
  const errorReporter = useErrorReporter();

  const showFeedback = useEffectEvent(({ error, feedback }: MutationErrorFeedbackEvent) => {
    haptics.notify('error');
    toast.error(getUserFacingMessage(error), { fallback: t(feedback.fallbackKey) });
    if (isUnexpectedError(error)) {
      errorReporter.captureException(toError(error), {
        feature: feedback.feature,
        ...getErrorReportTags(error),
      });
    }
  });

  useEffect(
    () =>
      subscribeMutationErrorFeedback(queryClient.getMutationCache(), (event) => {
        showFeedback(event);
      }),
    [queryClient],
  );

  return null;
}

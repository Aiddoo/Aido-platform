import type { MutationErrorFeedbackMeta } from '@src/shared/constants/query-meta';
import { useErrorReporter, useHaptics } from '@src/shared/di/shared-di-context';
import { getUserFacingMessage, reportUnexpectedError } from '@src/shared/errors';
import { t } from '@src/shared/i18n';
import { useAppToast } from '@src/shared/ui';

interface MutationErrorFeedbackOptions extends Pick<
  MutationErrorFeedbackMeta,
  'feature' | 'fallbackKey'
> {
  /** 오류 문구 대신 보일 제목. 실패 이유마다 제목이 다를 때 쓴다 */
  title?: string;
  /** 토스트 둘째 줄 */
  description?: string;
}

/**
 * mutation 실패를 햅틱·토스트 한 번으로 알리고 예상하지 못한 것만 보고한다. 전역 `meta.errorFeedback`이 쓰는 그 본체다.
 * `errorFeedback: false`인 mutation(실패 이유마다 다른 안내)과 여러 요청을 묶은 일괄 작업이 이것 하나로 알린다
 */
export function useMutationErrorFeedback() {
  const haptics = useHaptics();
  const toast = useAppToast();
  const errorReporter = useErrorReporter();

  return (
    error: unknown,
    { feature, fallbackKey = 'errors:fallback', title, description }: MutationErrorFeedbackOptions,
  ) => {
    haptics.notify('error');
    toast.error(title ?? getUserFacingMessage(error), { fallback: t(fallbackKey), description });
    reportUnexpectedError(errorReporter, error, feature);
  };
}

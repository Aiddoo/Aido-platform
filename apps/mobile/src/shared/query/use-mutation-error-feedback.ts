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

/** 전역 `meta.errorFeedback`의 본체로, `errorFeedback: false`인 mutation과 여러 요청을 묶은 일괄 작업도 이것으로 알린다 */
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

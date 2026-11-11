import { useClipboard, useLogger } from '@src/shared/di/shared-di-context';
import { getErrorMessage } from '@src/shared/errors';
import { useAppToast } from '@src/shared/ui/toast/use-app-toast';

interface CopyOptions {
  successMessage: string;
  successDescription?: string;
  failureMessage: string;
  failureLogEvent: string;
}

/** 클립보드에 복사하고 결과를 토스트로 알린다. 실패는 진단만 남기고 던지지 않는다 */
export function useCopyToClipboard() {
  const clipboard = useClipboard();
  const logger = useLogger();
  const toast = useAppToast();

  const copy = async (
    text: string,
    { successMessage, successDescription, failureMessage, failureLogEvent }: CopyOptions,
  ) => {
    try {
      await clipboard.copy(text);
      toast.success(successMessage, { description: successDescription });
    } catch (error) {
      logger.warn(failureLogEvent, { error: getErrorMessage(error) });
      toast.error(failureMessage);
    }
  };

  return { copy };
}

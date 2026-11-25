import { useClipboard, useLogger } from '@src/shared/di/shared-di-context';
import { toError } from '@src/shared/errors';
import { useAppToast } from '@src/shared/ui';

interface CopyOptions {
  successMessage: string;
  successDescription?: string;
  failureMessage: string;
  failureLogEvent: string;
}

/** 클립보드에 복사하고 결과를 토스트로 알린다. 실패는 로그 키의 기능 이름으로 보고하고 던지지 않는다 */
export function useCopyToClipboard(): (text: string, options: CopyOptions) => Promise<void> {
  const clipboard = useClipboard();
  const logger = useLogger();
  const toast = useAppToast();

  return async (text, { successMessage, successDescription, failureMessage, failureLogEvent }) => {
    try {
      await clipboard.copy(text);
      toast.success(successMessage, { description: successDescription });
    } catch (error) {
      // ClipboardCopyError는 예상하지 못한 SDK 실패라 로그 키가 밝힌 기능으로 보고한다
      logger.error(failureLogEvent, toError(error));
      toast.error(failureMessage);
    }
  };
}

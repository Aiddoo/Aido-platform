import { useLogger } from '@src/shared/di/shared-di-context';
import { getErrorMessage } from '@src/shared/errors';
import { KeyboardController } from 'react-native-keyboard-controller';

import { KEYBOARD_LOG_EVENT } from '../constants/keyboard-log-events';

interface DismissKeyboardOptions {
  /** 화면이 바로 바뀌어 키보드가 내려가는 모습을 보일 수 없을 때 끈다 */
  animated?: boolean;
}

/** RN `Keyboard.dismiss`는 RN `TextInput`만 내려 네이티브 검색창·편집기 키보드가 남을 수 있다. 실패는 로그만 남긴다 */
export function useDismissKeyboard(): (options?: DismissKeyboardOptions) => void {
  const logger = useLogger();

  return (options) => {
    KeyboardController.dismiss(options).catch((error: unknown) =>
      logger.warn(KEYBOARD_LOG_EVENT.DISMISS_FAILED, { error: getErrorMessage(error) }),
    );
  };
}

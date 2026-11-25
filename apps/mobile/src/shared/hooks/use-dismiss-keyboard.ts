import { useLogger } from '@src/shared/di/shared-di-context';
import { getErrorMessage } from '@src/shared/errors';
import { useCallback } from 'react';
import { KeyboardController } from 'react-native-keyboard-controller';

import { KEYBOARD_LOG_EVENT } from '../constants/keyboard-log-events';

interface DismissKeyboardOptions {
  /** 화면이 바로 바뀌어 키보드가 내려가는 모습을 보일 수 없을 때 끈다 */
  animated?: boolean;
}

/**
 * 키보드를 내리고 입력 포커스를 푼다. RN `Keyboard.dismiss`는 RN `TextInput`만 내려 네이티브 검색창·편집기 키보드가 남을 수 있어
 * 키보드 위치를 맡은 react-native-keyboard-controller로 내린다. 기다리지 않는 동작이라 실패는 로그만 남긴다
 */
export function useDismissKeyboard(): (options?: DismissKeyboardOptions) => void {
  const logger = useLogger();

  return useCallback(
    (options) => {
      KeyboardController.dismiss(options).catch((error: unknown) =>
        logger.warn(KEYBOARD_LOG_EVENT.DISMISS_FAILED, { error: getErrorMessage(error) }),
      );
    },
    [logger],
  );
}

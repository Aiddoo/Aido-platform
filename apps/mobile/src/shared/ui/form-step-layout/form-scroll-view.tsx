import type { ComponentProps } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';

import { KEYBOARD_ADAPTIVE_BUTTON_BOTTOM_OFFSET } from '../button';

/** 화면 폼의 스크롤 영역. 포커스한 입력이 키보드에 붙은 `KeyboardAdaptiveButton` 위로 오도록 그 높이만큼 띄워 스크롤한다 */
export function FormScrollView({
  style,
  ...props
}: ComponentProps<typeof KeyboardAwareScrollView>) {
  return (
    <KeyboardAwareScrollView
      bottomOffset={KEYBOARD_ADAPTIVE_BUTTON_BOTTOM_OFFSET}
      style={[{ flex: 1 }, style]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
    />
  );
}

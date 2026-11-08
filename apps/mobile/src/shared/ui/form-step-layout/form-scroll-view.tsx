import type { ReactNode } from 'react';
import type { ScrollViewProps } from 'react-native';
import Animated from 'react-native-reanimated';

import { FocusedFieldContext } from '../input/focused-field';
import { KeyboardFooterHeightContext } from './keyboard-footer-height';
import { useFocusedFieldKeyboardScroll } from './use-focused-field-keyboard-scroll';

export interface FormScrollViewProps extends ScrollViewProps {
  /** 키보드에 붙는 주 동작 버튼(`KeyboardAdaptiveButton`). 스크롤 밖 아래에 두고, 포커스한 칸은 이 버튼 위로 올린다 */
  footer?: ReactNode;
}

/** 화면 폼의 스크롤 영역. 포커스한 칸 전체(라벨·입력 칸·오류 문구·글자 수)가 키보드에 붙은 `footer` 위로 오도록 스크롤한다 */
export function FormScrollView({ style, children, footer, ...props }: FormScrollViewProps) {
  const { scrollRef, keyboardSpaceStyle, reportFocusedField, reportFooterHeight } =
    useFocusedFieldKeyboardScroll();

  return (
    <>
      <FocusedFieldContext value={reportFocusedField}>
        <Animated.ScrollView
          ref={scrollRef}
          style={[{ flex: 1 }, style]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          {...props}
        >
          {children}
          <Animated.View style={keyboardSpaceStyle} />
        </Animated.ScrollView>
      </FocusedFieldContext>
      <KeyboardFooterHeightContext value={reportFooterHeight}>{footer}</KeyboardFooterHeightContext>
    </>
  );
}

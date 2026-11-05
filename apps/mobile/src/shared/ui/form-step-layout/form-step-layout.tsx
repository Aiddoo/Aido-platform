import { ANIMATION } from '@src/shared/constants/animation.constants';
import type { ComponentProps, ReactNode } from 'react';
import { KeyboardAwareScrollView } from 'react-native-keyboard-controller';
import Animated, { FadeIn } from 'react-native-reanimated';

import { KEYBOARD_ADAPTIVE_BUTTON_BOTTOM_OFFSET } from '../button';
import { StyledSafeAreaView } from '../styled-safe-area-view';
import { H3 } from '../text';

export interface FormStepLayoutProps extends Omit<
  ComponentProps<typeof KeyboardAwareScrollView>,
  'children'
> {
  /** 단계 제목. 바뀌면 제목만 다시 페이드인한다. */
  title: string;
  children: ReactNode;
}

/**
 * 폼 단계 화면의 스크롤 영역 — 가로 safe area, 페이드인 제목, 입력 영역 순서로 놓는다.
 * 작은 화면·큰 글자에서도 포커스한 입력이 키보드에 붙은 하단 버튼 위로 올라온다.
 */
export function FormStepLayout({
  title,
  children,
  style,
  contentContainerStyle,
  ...props
}: FormStepLayoutProps) {
  return (
    <KeyboardAwareScrollView
      bottomOffset={KEYBOARD_ADAPTIVE_BUTTON_BOTTOM_OFFSET}
      style={[{ flex: 1 }, style]}
      contentContainerStyle={[
        { paddingHorizontal: 16, paddingTop: 24, paddingBottom: 100 },
        contentContainerStyle,
      ]}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
    >
      <StyledSafeAreaView edges={['left', 'right']}>
        <Animated.View
          key={title}
          entering={FadeIn.duration(ANIMATION.duration.slow)}
          style={{ marginBottom: 24 }}
        >
          <H3>{title}</H3>
        </Animated.View>

        {children}
      </StyledSafeAreaView>
    </KeyboardAwareScrollView>
  );
}

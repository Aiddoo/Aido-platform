import { ANDROID_API_LEVEL } from '@src/shared/infra/device/device-info';
import { useKeyboardBottomGap } from '@src/shared/providers/keyboard-bottom-gap-provider';
import { useIsFocused } from 'expo-router';
import type { ComponentProps, Ref } from 'react';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';
import type Reanimated from 'react-native-reanimated';
import { useDerivedValue, useSharedValue } from 'react-native-reanimated';

import { useTodoCommentReveal } from './todo-comment-reveal';

interface TodoCommentKeyboardScrollViewProps extends Omit<
  ComponentProps<typeof KeyboardChatScrollView>,
  | 'ref'
  | 'automaticallyAdjustContentInsets'
  | 'contentInsetAdjustmentBehavior'
  | 'keyboardDismissMode'
  | 'keyboardShouldPersistTaps'
  | 'freeze'
  | 'extraContentPadding'
  | 'blankSpace'
> {
  ref?: Ref<Reanimated.ScrollView>;
}

/** Android 11(API 30)부터 키보드를 따라 움직이는 인셋 애니메이션을 시스템이 지원한다 */
const ANDROID_KEYBOARD_ANIMATION_API_LEVEL = 30;
const IS_LEGACY_ANDROID_KEYBOARD =
  ANDROID_API_LEVEL != null && ANDROID_API_LEVEL < ANDROID_KEYBOARD_ANIMATION_API_LEVEL;

function getKeyboardDismissMode(): 'interactive' | 'on-drag' | 'none' {
  if (process.env.EXPO_OS === 'ios') {
    return 'interactive';
  }

  return IS_LEGACY_ANDROID_KEYBOARD ? 'on-drag' : 'none';
}

const KEYBOARD_DISMISS_MODE = getKeyboardDismissMode();

export function TodoCommentKeyboardScrollView({
  keyboardLiftBehavior = 'whenAtEnd',
  onLayout,
  onContentSizeChange,
  ...props
}: TodoCommentKeyboardScrollViewProps) {
  const keyboardBottomGap = useKeyboardBottomGap();
  const { extraContentPadding } = useTodoCommentReveal();
  // 대화를 push한 동안 아래에 남은 개요가 위 화면의 키보드에 반응하면 돌아왔을 때 스크롤 위치가 밀린다.
  const isScreenFocused = useIsFocused();
  const viewportHeight = useSharedValue(0);
  const contentHeight = useSharedValue(0);
  // 내용이 짧으면 아래 빈자리가 키보드를 받아 내, 첫 댓글을 쓸 때 할 일이 화면 밖으로 밀리지 않는다.
  // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
  const blankSpace = useDerivedValue(() => Math.max(0, viewportHeight.value - contentHeight.value));

  return (
    <KeyboardChatScrollView
      {...props}
      onLayout={(event) => {
        // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
        viewportHeight.value = event.nativeEvent.layout.height;
        onLayout?.(event);
      }}
      onContentSizeChange={(width, height) => {
        // oxlint-disable-next-line aido/shared-value-accessor -- 1.15.2 전환 #1400
        contentHeight.value = height;
        onContentSizeChange?.(width, height);
      }}
      blankSpace={blankSpace}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode={KEYBOARD_DISMISS_MODE}
      keyboardShouldPersistTaps="handled"
      keyboardLiftBehavior={keyboardLiftBehavior}
      offset={keyboardBottomGap}
      extraContentPadding={extraContentPadding}
      freeze={!isScreenFocused}
    />
  );
}

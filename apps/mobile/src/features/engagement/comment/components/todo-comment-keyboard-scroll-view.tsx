import { useKeyboardBottomGap } from '@src/shared/providers/keyboard-bottom-gap-provider';
import { useIsFocused } from 'expo-router';
import type { ComponentProps, Ref } from 'react';
import { Platform } from 'react-native';
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

const isLegacyAndroidKeyboard =
  process.env.EXPO_OS === 'android' &&
  typeof Platform.Version === 'number' &&
  Platform.Version < 30;
const keyboardDismissMode =
  process.env.EXPO_OS === 'ios' ? 'interactive' : isLegacyAndroidKeyboard ? 'on-drag' : 'none';

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
  const blankSpace = useDerivedValue(() => Math.max(0, viewportHeight.value - contentHeight.value));

  return (
    <KeyboardChatScrollView
      {...props}
      onLayout={(event) => {
        viewportHeight.value = event.nativeEvent.layout.height;
        onLayout?.(event);
      }}
      onContentSizeChange={(width, height) => {
        contentHeight.value = height;
        onContentSizeChange?.(width, height);
      }}
      blankSpace={blankSpace}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps="handled"
      keyboardLiftBehavior={keyboardLiftBehavior}
      offset={keyboardBottomGap}
      extraContentPadding={extraContentPadding}
      freeze={!isScreenFocused}
    />
  );
}

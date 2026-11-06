import { useKeyboardBottomGap } from '@src/shared/providers/keyboard-bottom-gap-provider';
import { useIsFocused } from 'expo-router';
import type { ComponentProps, Ref } from 'react';
import { Platform } from 'react-native';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';
import type Reanimated from 'react-native-reanimated';

interface TodoCommentKeyboardScrollViewProps extends Omit<
  ComponentProps<typeof KeyboardChatScrollView>,
  | 'ref'
  | 'automaticallyAdjustContentInsets'
  | 'contentInsetAdjustmentBehavior'
  | 'keyboardDismissMode'
  | 'keyboardShouldPersistTaps'
  | 'freeze'
> {
  ref?: Ref<Reanimated.ScrollView>;
}

const isLegacyAndroidKeyboard =
  Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version < 30;
const keyboardDismissMode =
  Platform.OS === 'ios' ? 'interactive' : isLegacyAndroidKeyboard ? 'on-drag' : 'none';

export function TodoCommentKeyboardScrollView({
  keyboardLiftBehavior = 'whenAtEnd',
  ...props
}: TodoCommentKeyboardScrollViewProps) {
  const keyboardBottomGap = useKeyboardBottomGap();
  // 대화를 push한 동안 아래에 남은 개요가 위 화면의 키보드에 반응하면 돌아왔을 때 스크롤 위치가 밀린다.
  const isScreenFocused = useIsFocused();

  return (
    <KeyboardChatScrollView
      {...props}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps="handled"
      keyboardLiftBehavior={keyboardLiftBehavior}
      offset={keyboardBottomGap}
      freeze={!isScreenFocused}
    />
  );
}

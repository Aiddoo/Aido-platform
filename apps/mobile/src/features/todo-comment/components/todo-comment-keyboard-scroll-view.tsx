import { useKeyboardBottomGap } from '@src/shared/providers/keyboard-bottom-gap-provider';
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
> {
  ref?: Ref<Reanimated.ScrollView>;
}

const usesLegacyAndroidKeyboard =
  Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version < 30;
const keyboardDismissMode =
  Platform.OS === 'ios' ? 'interactive' : usesLegacyAndroidKeyboard ? 'on-drag' : 'none';

export function TodoCommentKeyboardScrollView({
  keyboardLiftBehavior = 'whenAtEnd',
  ...props
}: TodoCommentKeyboardScrollViewProps) {
  const keyboardBottomGap = useKeyboardBottomGap();

  return (
    <KeyboardChatScrollView
      {...props}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps="handled"
      keyboardLiftBehavior={keyboardLiftBehavior}
      offset={keyboardBottomGap}
    />
  );
}

import { type ComponentProps, forwardRef } from 'react';
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
> {}

const usesLegacyAndroidKeyboard =
  Platform.OS === 'android' && typeof Platform.Version === 'number' && Platform.Version < 30;
const keyboardDismissMode =
  Platform.OS === 'ios' ? 'interactive' : usesLegacyAndroidKeyboard ? 'on-drag' : 'none';

export const TodoCommentKeyboardScrollView = forwardRef<
  Reanimated.ScrollView,
  TodoCommentKeyboardScrollViewProps
>(function TodoCommentKeyboardScrollView({ keyboardLiftBehavior = 'whenAtEnd', ...props }, ref) {
  return (
    <KeyboardChatScrollView
      {...props}
      ref={ref}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode={keyboardDismissMode}
      keyboardShouldPersistTaps="handled"
      keyboardLiftBehavior={keyboardLiftBehavior}
    />
  );
});

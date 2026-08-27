import { type ComponentProps, forwardRef } from 'react';
import { KeyboardChatScrollView } from 'react-native-keyboard-controller';
import type Reanimated from 'react-native-reanimated';

interface CommentKeyboardScrollViewProps extends Omit<
  ComponentProps<typeof KeyboardChatScrollView>,
  | 'ref'
  | 'automaticallyAdjustContentInsets'
  | 'contentInsetAdjustmentBehavior'
  | 'keyboardDismissMode'
  | 'keyboardShouldPersistTaps'
> {}

export const TodoCommentKeyboardScrollView = forwardRef<
  Reanimated.ScrollView,
  CommentKeyboardScrollViewProps
>(function TodoCommentKeyboardScrollView({ keyboardLiftBehavior = 'whenAtEnd', ...props }, ref) {
  return (
    <KeyboardChatScrollView
      {...props}
      ref={ref}
      automaticallyAdjustContentInsets={false}
      contentInsetAdjustmentBehavior="never"
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
      keyboardLiftBehavior={keyboardLiftBehavior}
    />
  );
});

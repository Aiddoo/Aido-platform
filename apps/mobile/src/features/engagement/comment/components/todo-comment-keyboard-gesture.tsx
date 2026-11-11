import { Box } from '@src/shared/ui';
import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { KeyboardGestureArea } from 'react-native-keyboard-controller';

import { TODO_COMMENT_INPUT_NATIVE_ID } from '../constants/todo-comment.constants';

const styles = StyleSheet.create({ gestureArea: { flex: 1 } });

/** 목록과 작성 바를 함께 감싸 Android에서 키보드를 손가락으로 끌어 내리게 한다 */
export function TodoCommentKeyboardGesture({ children }: PropsWithChildren) {
  return (
    <KeyboardGestureArea
      style={styles.gestureArea}
      textInputNativeID={TODO_COMMENT_INPUT_NATIVE_ID}
    >
      <Box flex={1} testID="todo-comment-threads">
        {children}
      </Box>
    </KeyboardGestureArea>
  );
}

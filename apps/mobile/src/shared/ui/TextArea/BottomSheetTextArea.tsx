import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { forwardRef } from 'react';
import type { TextInput } from 'react-native';
import { withUniwind } from 'uniwind';

import { TextArea } from './TextArea';
import type { TextAreaProps } from './TextArea.types';

const StyledBottomSheetTextInput = withUniwind(BottomSheetTextInput);

/**
 * BottomSheet 내부에서 사용하는 TextArea 컴포넌트
 * gorhom bottom sheet의 키보드 대응을 위해 BottomSheetTextInput을 사용
 */
export const BottomSheetTextArea = forwardRef<TextInput, TextAreaProps>((props, ref) => {
  return <TextArea ref={ref} textInputComponent={StyledBottomSheetTextInput} {...props} />;
});

BottomSheetTextArea.displayName = 'BottomSheetTextArea';

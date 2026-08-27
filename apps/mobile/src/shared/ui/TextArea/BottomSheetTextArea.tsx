import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { forwardRef } from 'react';
import type { TextInput } from 'react-native';
import { withUniwind } from 'uniwind';

import { TextArea } from './TextArea';
import type { TextAreaProps } from './TextArea.types';

const StyledBottomSheetTextInput = withUniwind(BottomSheetTextInput);

export const BottomSheetTextArea = forwardRef<TextInput, TextAreaProps>((props, ref) => {
  return <TextArea ref={ref} textInputComponent={StyledBottomSheetTextInput} {...props} />;
});

BottomSheetTextArea.displayName = 'BottomSheetTextArea';

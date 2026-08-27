import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { forwardRef } from 'react';
import type { TextInput } from 'react-native';
import { withUniwind } from 'uniwind';

import { Input } from './Input';
import type { InputProps } from './Input.types';

const StyledBottomSheetTextInput = withUniwind(BottomSheetTextInput);

export const BottomSheetInput = forwardRef<TextInput, InputProps>((props, ref) => {
  return <Input ref={ref} textInputComponent={StyledBottomSheetTextInput} {...props} />;
});

BottomSheetInput.displayName = 'BottomSheetInput';

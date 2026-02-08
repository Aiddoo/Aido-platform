import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { forwardRef } from 'react';
import type { TextInput } from 'react-native';
import { withUniwind } from 'uniwind';
import { Input } from './Input';
import type { InputProps } from './Input.types';

const StyledBottomSheetTextInput = withUniwind(BottomSheetTextInput);

/**
 * BottomSheet 내부에서 사용하는 Input 컴포넌트
 * gorhom bottom sheet의 키보드 대응을 위해 BottomSheetTextInput을 사용
 */
export const BottomSheetInput = forwardRef<TextInput, InputProps>((props, ref) => {
  return <Input ref={ref} textInputComponent={StyledBottomSheetTextInput} {...props} />;
});

BottomSheetInput.displayName = 'BottomSheetInput';

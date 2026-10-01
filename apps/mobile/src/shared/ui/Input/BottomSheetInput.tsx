import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import type {
  ComponentRef,
  ForwardRefExoticComponent,
  PropsWithoutRef,
  RefAttributes,
} from 'react';
import { forwardRef } from 'react';
import type { TextInput } from 'react-native';
import { withUniwind } from 'uniwind';

import { Input } from './Input';
import type { InputProps } from './Input.types';

const StyledBottomSheetTextInput = withUniwind(BottomSheetTextInput);

export const BottomSheetInput: ForwardRefExoticComponent<
  PropsWithoutRef<InputProps> & RefAttributes<ComponentRef<typeof TextInput>>
> = forwardRef<ComponentRef<typeof TextInput>, InputProps>((props, ref) => {
  return <Input ref={ref} textInputComponent={StyledBottomSheetTextInput} {...props} />;
});

BottomSheetInput.displayName = 'BottomSheetInput';

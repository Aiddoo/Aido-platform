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

import { TextArea } from './text-area';
import type { TextAreaProps } from './text-area.types';

const StyledBottomSheetTextInput = withUniwind(BottomSheetTextInput);

export const BottomSheetTextArea: ForwardRefExoticComponent<
  PropsWithoutRef<TextAreaProps> & RefAttributes<ComponentRef<typeof TextInput>>
> = forwardRef<ComponentRef<typeof TextInput>, TextAreaProps>((props, ref) => {
  return <TextArea ref={ref} textInputComponent={StyledBottomSheetTextInput} {...props} />;
});

BottomSheetTextArea.displayName = 'BottomSheetTextArea';

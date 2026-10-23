import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { withUniwind } from 'uniwind';

import { Input } from './input';
import type { InputProps } from './input.types';

const StyledBottomSheetTextInput = withUniwind(BottomSheetTextInput);

export function BottomSheetInput(props: InputProps) {
  return <Input textInputComponent={StyledBottomSheetTextInput} {...props} />;
}

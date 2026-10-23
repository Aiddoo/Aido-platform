import { BottomSheetTextInput } from '@gorhom/bottom-sheet';
import { withUniwind } from 'uniwind';

import { TextArea } from './text-area';
import type { TextAreaProps } from './text-area.types';

const StyledBottomSheetTextInput = withUniwind(BottomSheetTextInput);

export function BottomSheetTextArea(props: TextAreaProps) {
  return <TextArea textInputComponent={StyledBottomSheetTextInput} {...props} />;
}

import { CategorySelectInput } from '@src/features/todo/components/category-select-input';
import { ModalBottomSheet } from '@src/shared/ui';
import type { ComponentProps } from 'react';
import { Suspense } from 'react';
import { ActivityIndicator } from 'react-native';

type MemoTodoCategoryBottomSheetProps = Omit<ComponentProps<typeof ModalBottomSheet>, 'children'> &
  Pick<ComponentProps<typeof CategorySelectInput>, 'value' | 'onChange' | 'submitLabel'>;

export function MemoTodoCategoryBottomSheet({
  value,
  onChange,
  submitLabel,
  ...props
}: MemoTodoCategoryBottomSheetProps) {
  return (
    <ModalBottomSheet {...props}>
      <Suspense fallback={<ActivityIndicator />}>
        <CategorySelectInput value={value} onChange={onChange} submitLabel={submitLabel} />
      </Suspense>
    </ModalBottomSheet>
  );
}

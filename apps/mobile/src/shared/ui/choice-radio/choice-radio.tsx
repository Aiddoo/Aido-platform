import { cn } from '@src/shared/utils/cn';
import { Radio } from 'heroui-native';
import type { ComponentProps } from 'react';

/** heroui는 고르지 않은 원을 테두리 없이 입력칸 면(--field-background)으로 채워 같은 색 카드·시트 위에서 사라지므로 테두리만 남긴다 */
export function ChoiceRadio(props: Omit<ComponentProps<typeof Radio>, 'children'>) {
  return (
    <Radio {...props}>
      {({ isSelected }) => (
        <Radio.Indicator
          className={cn(!isSelected && 'border-2 border-gray-5 bg-transparent shadow-none')}
        />
      )}
    </Radio>
  );
}

import { cn } from '@src/shared/utils/cn';
import { Radio } from 'heroui-native';
import type { ComponentProps } from 'react';

/**
 * heroui 기본 표시는 고르지 않은 원을 입력칸 바탕(--field-background)으로 채워 다크 테마에서 검게 칠한 원처럼 보인다.
 * 그 토큰은 Input·Checkbox·Select와 같이 쓰므로 바꾸지 않고, 고르지 않은 원만 테두리만 남긴다
 */
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

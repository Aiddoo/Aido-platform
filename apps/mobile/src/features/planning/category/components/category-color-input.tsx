import { Flex } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { RadioGroup } from 'heroui-native';
import type { ComponentProps } from 'react';

import { CATEGORY_COLORS } from '../constants/todo-category.constants';

interface CategoryColorInputProps extends Omit<
  ComponentProps<typeof RadioGroup>,
  'children' | 'value' | 'onValueChange'
> {
  value: string;
  onChange: (color: string) => void;
}

/** 카테고리 색상 팔레트에서 하나를 고르는 입력. 생성·수정 시트가 함께 쓴다. */
export function CategoryColorInput({
  value,
  onChange,
  className,
  ...props
}: CategoryColorInputProps) {
  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
      className={cn('flex-row flex-wrap items-center justify-center gap-2.5', className)}
      {...props}
    >
      {CATEGORY_COLORS.map((color) => (
        <RadioGroup.Item key={color} value={color}>
          {({ isSelected }) => (
            <Flex
              align="center"
              justify="center"
              className={cn('size-8 rounded-full', isSelected && 'border-2')}
              style={isSelected ? { borderColor: color } : undefined}
            >
              <Flex
                className={cn('rounded-full', isSelected ? 'size-6' : 'size-7')}
                style={{ backgroundColor: color }}
              />
            </Flex>
          )}
        </RadioGroup.Item>
      ))}
    </RadioGroup>
  );
}

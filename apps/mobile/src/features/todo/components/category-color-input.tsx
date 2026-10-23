import { Flex, HStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps } from 'react';

import { CATEGORY_COLORS } from '../constants/todo-category-colors';

interface CategoryColorInputProps extends Omit<ComponentProps<typeof HStack>, 'children'> {
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
    <HStack
      align="center"
      justify="center"
      className={cn('flex-wrap gap-2.5', className)}
      accessibilityRole="radiogroup"
      {...props}
    >
      {CATEGORY_COLORS.map((color) => {
        const isSelected = value === color;

        return (
          <PressableFeedback
            key={color}
            onPress={() => onChange(color)}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
          >
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
          </PressableFeedback>
        );
      })}
    </HStack>
  );
}

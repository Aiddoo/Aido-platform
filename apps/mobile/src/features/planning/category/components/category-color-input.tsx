import { useTranslation } from '@src/shared/i18n';
import { HStack } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { RadioGroup } from 'heroui-native';
import type { ComponentProps } from 'react';

import { CATEGORY_COLORS } from '../constants/todo-category.constants';

interface CategoryColorInputProps extends Omit<
  ComponentProps<typeof RadioGroup>,
  'children' | 'value' | 'onValueChange'
> {
  value: string;
  onValueChange: (color: string) => void;
}

/** 32px 색 칸을 터치 기준 44px에 맞춘다 */
const COLOR_ITEM_HIT_SLOP = 6;

export function CategoryColorInput({
  value,
  onValueChange,
  className,
  ...props
}: CategoryColorInputProps) {
  const { t } = useTranslation('todo');

  return (
    <RadioGroup
      value={value}
      onValueChange={onValueChange}
      className={cn('flex-row flex-wrap items-center justify-center gap-2.5', className)}
      {...props}
    >
      {CATEGORY_COLORS.map((color, index) => (
        <RadioGroup.Item
          key={color}
          value={color}
          hitSlop={COLOR_ITEM_HIT_SLOP}
          accessibilityLabel={t('category.colorOption', {
            index: index + 1,
            total: CATEGORY_COLORS.length,
          })}
        >
          {({ isSelected }) => (
            <HStack
              align="center"
              justify="center"
              className={cn('size-8 rounded-full', isSelected && 'border-2')}
              style={isSelected ? { borderColor: color } : undefined}
            >
              <HStack
                className={cn('rounded-full', isSelected ? 'size-6' : 'size-7')}
                style={{ backgroundColor: color }}
              />
            </HStack>
          )}
        </RadioGroup.Item>
      ))}
    </RadioGroup>
  );
}

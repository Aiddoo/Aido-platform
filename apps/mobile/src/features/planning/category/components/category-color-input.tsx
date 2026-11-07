import { useTranslation } from '@src/shared/i18n';
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

/** 32px 색 칸을 터치 기준 44px에 맞춘다 */
const COLOR_ITEM_HIT_SLOP = 6;

/** 카테고리 색상 팔레트에서 하나를 고르는 입력. 생성·수정 시트가 함께 쓴다. */
export function CategoryColorInput({
  value,
  onChange,
  className,
  ...props
}: CategoryColorInputProps) {
  const { t } = useTranslation('todo');

  return (
    <RadioGroup
      value={value}
      onValueChange={onChange}
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

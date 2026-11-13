import { useAppWindow } from '@src/shared/hooks/use-app-window';
import { useTranslation } from '@src/shared/i18n';
import { HStack, SheetChipRow } from '@src/shared/ui';
import { WindowLayoutPolicy } from '@src/shared/ui';
import { getChipRevealScrollX } from '@src/shared/ui';
import { cn } from '@src/shared/utils/cn';
import { RadioGroup } from 'heroui-native';
import { type ComponentProps, type ComponentRef, useRef } from 'react';
import type {
  LayoutChangeEvent,
  LayoutRectangle,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';

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
  // 낮은 창은 키보드를 올리면 두 줄 색이 입력칸과 확인 사이에서 밀려나 스크롤해야 고를 수 있어 한 줄로 민다
  const isSingleRow = WindowLayoutPolicy.isShortWindow(useAppWindow());
  const rowRef = useRef<ComponentRef<typeof SheetChipRow>>(null);
  const rowWidthRef = useRef(0);
  const rowScrollXRef = useRef(0);
  const colorFramesRef = useRef(new Map<string, LayoutRectangle>());

  // 고른 색이 줄 밖이나 끝에 걸쳐 있을 때만 다 보일 만큼 민다. 고친 카테고리의 색은 처음부터 보이고 누른 색은 줄 앞으로 끌려가지 않는다
  const revealColor = (color: string, animated: boolean) => {
    const chip = colorFramesRef.current.get(color);
    if (chip == null || rowWidthRef.current === 0) {
      return;
    }
    const scrollX = getChipRevealScrollX({
      chip,
      scrollX: rowScrollXRef.current,
      rowWidth: rowWidthRef.current,
    });
    if (scrollX != null) {
      rowScrollXRef.current = scrollX;
      rowRef.current?.scrollTo({ x: scrollX, animated });
    }
  };

  const handleRowLayout = (event: LayoutChangeEvent) => {
    rowWidthRef.current = event.nativeEvent.layout.width;
    revealColor(value, false);
  };

  const handleRowScroll = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    rowScrollXRef.current = event.nativeEvent.contentOffset.x;
  };

  const handleColorLayout = (color: string, event: LayoutChangeEvent) => {
    colorFramesRef.current.set(color, event.nativeEvent.layout);
    if (color === value) {
      revealColor(color, false);
    }
  };

  const handleValueChange = (color: string) => {
    onValueChange(color);
    revealColor(color, true);
  };

  const palette = (
    <RadioGroup
      value={value}
      onValueChange={handleValueChange}
      className={cn(
        'flex-row items-center gap-2.5',
        // 한 줄일 때는 터치 여백(6)이 가로 줄 위아래로 잘리지 않게 줄 높이에 넣는다
        isSingleRow ? 'py-1.5' : 'flex-wrap justify-center',
        className,
      )}
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
          onLayout={isSingleRow ? (event) => handleColorLayout(color, event) : undefined}
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

  return isSingleRow ? (
    <SheetChipRow
      ref={rowRef}
      onLayout={handleRowLayout}
      onScroll={handleRowScroll}
      scrollEventThrottle={16}
    >
      {palette}
    </SheetChipRow>
  ) : (
    palette
  );
}

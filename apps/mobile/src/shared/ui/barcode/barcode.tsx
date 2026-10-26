import type { ComponentProps } from 'react';

import { Box } from '../box';
import { HStack } from '../h-stack/h-stack';

// 실제 코드를 담지 않는 장식이라 막대 굵기 배열을 고정한다
const BARCODE_BAR_WIDTHS = [
  4, 1, 3, 1, 2, 1, 1, 3, 1, 2, 3, 1, 1, 2, 1, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 1,
  2, 1, 1, 3, 1, 2, 1, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3,
] as const;

const BAR_UNIT_WIDTH = 1.8;

export interface BarcodeProps extends Omit<ComponentProps<typeof HStack>, 'children'> {
  /** 막대 높이(pt) */
  height?: number;
}

/** 영수증 카드 아래쪽 바코드 장식. 스크린 리더에서는 읽지 않는다. */
export function Barcode({ height = 32, ...props }: BarcodeProps) {
  return (
    <HStack
      align="end"
      justify="center"
      gap={1.5}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      {...props}
    >
      {BARCODE_BAR_WIDTHS.map((barWidth, index) => (
        <Box
          // 순서와 개수가 고정된 장식이라 index가 안정적인 key다
          key={index}
          className="bg-gray-7 rounded-[0.5px]"
          style={{ width: barWidth * BAR_UNIT_WIDTH, height }}
        />
      ))}
    </HStack>
  );
}

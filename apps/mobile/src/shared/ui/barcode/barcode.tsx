import Svg, { Path } from 'react-native-svg';
import { useResolveClassNames } from 'uniwind';

import { HStack } from '../h-stack/h-stack';

// 실제 코드를 담지 않는 장식이라 막대 굵기 배열을 고정한다
const BARCODE_BAR_WIDTHS = [
  4, 1, 3, 1, 2, 1, 1, 3, 1, 2, 3, 1, 1, 2, 1, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1, 3, 2, 1, 1, 2, 3, 1, 1,
  2, 1, 1, 3, 1, 2, 1, 3, 1, 1, 2, 1, 3, 1, 2, 1, 1, 3, 1, 2, 1, 1, 2, 3, 1, 1, 2, 1, 3,
] as const;

const BAR_UNIT_WIDTH = 1.8;
const BAR_GAP = 1.5;

/** 막대마다 뷰를 두지 않고 높이 1짜리 경로 하나로 그려 높이는 viewBox로 늘린다 */
const BARCODE = BARCODE_BAR_WIDTHS.reduce(
  ({ pathData, x }, barWidth) => {
    const width = barWidth * BAR_UNIT_WIDTH;
    return { pathData: `${pathData}M${x} 0h${width}v1h-${width}z`, x: x + width + BAR_GAP };
  },
  { pathData: '', x: 0 },
);
const BARCODE_WIDTH = BARCODE.x - BAR_GAP;

interface BarcodeProps {
  /** 막대 높이(pt) */
  height?: number;
  className?: string;
}

/** 영수증 카드 아래쪽 바코드 장식. 스크린 리더에서는 읽지 않는다. */
export function Barcode({ height = 32, className }: BarcodeProps) {
  const { backgroundColor: fill } = useResolveClassNames('bg-gray-7');

  return (
    <HStack
      justify="center"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      className={className}
    >
      <Svg
        width={BARCODE_WIDTH}
        height={height}
        viewBox={`0 0 ${BARCODE_WIDTH} 1`}
        preserveAspectRatio="none"
      >
        <Path d={BARCODE.pathData} fill={fill} />
      </Svg>
    </HStack>
  );
}

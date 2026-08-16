import { Text } from '@src/shared/ui';
import { formatCappedCount } from '@src/shared/utils/format';
import { PressableFeedback } from 'heroui-native';
import type { ComponentProps, ReactNode } from 'react';

/**
 * 아이콘 글리프의 크기. 하트와 말풍선이 같은 상자를 쓰므로 나란히 놓았을 때 무게가 맞는다.
 * 두 아이콘 모두 24 뷰박스에 안쪽 여백이 비슷해, 같은 값이면 잉크 크기도 거의 같다.
 */
export const ICON_COUNT_BUTTON_ICON_SIZE = 18;

/**
 * 버튼이 스스로 두르는 가로 여백(px-2 = 8px).
 * 버튼끼리는 붙여 놓고 이 여백이 사이를 벌리므로, 눌리는 영역에 빈틈도 겹침도 없다.
 */
const HORIZONTAL_PADDING = 8;

/** 글리프가 상자 안에서 비워 두는 여백. 하트·말풍선 모두 18px 기준 약 2px다. */
const GLYPH_INSET = 2;

/**
 * 아이콘 줄을 놓는 쪽이 되돌려야 할 값 — 이만큼 당겨야 잉크가 본문 왼쪽 선과 맞물린다.
 */
export const ICON_COUNT_BUTTON_INK_INSET = HORIZONTAL_PADDING + GLYPH_INSET;

/** 세로로만 넓힌다. 가로는 여백이 이미 벌려 두어 옆 버튼의 영역을 침범하지 않는다. */
const HIT_SLOP = { top: 8, bottom: 8, left: 0, right: 0 };

interface IconCountButtonProps extends Omit<
  ComponentProps<typeof PressableFeedback>,
  'children' | 'className' | 'hitSlop'
> {
  icon: ReactNode;
  /** 0이면 숫자를 숨긴다 — 아이콘만 남는다. 100 이상은 99+로 접힌다. */
  count: number;
}

/**
 * 아이콘 옆에 숫자를 붙인 버튼. 좋아요·답글이 공유하는 단 하나의 반복 단위라 도메인은 모른다.
 *
 * 폭은 내용만큼만 차지한다. 최소 폭을 주면 숫자 자릿수에 따라 남는 자리가 달라져
 * 옆 아이콘과의 간격이 매번 달라 보인다. 숫자가 커져도 99+에서 멈추므로,
 * 옆 아이콘이 밀리는 폭은 세 글자를 넘지 않는다.
 */
export function IconCountButton({ icon, count, ...props }: IconCountButtonProps) {
  return (
    <PressableFeedback
      {...props}
      hitSlop={HIT_SLOP}
      className="flex-row items-center gap-1 px-2 py-1.5"
    >
      {icon}
      {count > 0 && (
        <Text size="e1" shade={6}>
          {formatCappedCount(count)}
        </Text>
      )}
    </PressableFeedback>
  );
}

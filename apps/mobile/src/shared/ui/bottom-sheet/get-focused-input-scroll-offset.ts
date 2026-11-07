import { clamp } from 'es-toolkit';

/** 창 좌표 기준 세로 범위 */
export interface VerticalRect {
  top: number;
  height: number;
}

export interface ScrollLayout {
  /** 스크롤 뷰 자체(보이는 영역) */
  viewport: VerticalRect;
  /** 스크롤되는 내용 전체. 스크롤한 만큼 viewport보다 위에서 시작한다 */
  content: VerticalRect;
  /** 포커스된 입력 */
  input: VerticalRect;
}

/**
 * 키보드가 다 올라온 뒤의 시트 스크롤 영역 배치를 미리 구한다.
 * gorhom(keyboardBehavior="interactive")은 시트를 키보드 위로 올리고, 위쪽 한계(topInset+손잡이)에 닿으면
 * 스크롤 영역 높이를 줄인다. 어느 쪽이든 영역 아래 끝은 키보드 위에 붙는다.
 * 키보드가 올라오기 시작할 때 이 배치로 스크롤해야 키보드·시트와 한 동작으로 움직인다.
 */
export function getLayoutAboveKeyboard(
  { viewport, content, input }: ScrollLayout,
  keyboardTop: number,
  viewportTopLimit: number,
): ScrollLayout {
  const height = clamp(keyboardTop - viewportTopLimit, 0, viewport.height);
  const shift = keyboardTop - height - viewport.top;
  return {
    viewport: { top: viewport.top + shift, height },
    content: { top: content.top + shift, height: content.height },
    input: { top: input.top + shift, height: input.height },
  };
}

export interface FocusedInputScrollInput extends ScrollLayout {
  /** viewport 아래쪽을 덮는 높이(고정 footer) */
  bottomInset: number;
  /** 입력 위로 함께 보여 줄 높이(라벨·입력 칸 테두리) */
  marginAbove: number;
  /** 입력 아래로 함께 보여 줄 높이(입력 칸 테두리) */
  marginBelow: number;
}

/**
 * 포커스된 입력이 viewport에서 가려지지 않게 하는 스크롤 위치. 이미 보이거나 이 스크롤 내용 밖의 입력이면 null.
 * 위아래 여백까지 다 들어가지 않으면 입력 칸 전체가 footer 위에 오는 쪽(아래)을 우선하고,
 * 입력 자체도 들어가지 않을 만큼 좁으면 커서가 있는 입력 위쪽을 맞춘다.
 */
export function getFocusedInputScrollOffset(layout: FocusedInputScrollInput): number | null {
  const { viewport, content, input } = layout;
  if (input.top < content.top || input.top + input.height > content.top + content.height) {
    return null;
  }

  const delta = getScrollDelta(layout);
  if (delta === 0) {
    return null;
  }

  const currentOffset = viewport.top - content.top;
  const maxOffset = Math.max(0, content.height - viewport.height);
  const nextOffset = clamp(currentOffset + delta, 0, maxOffset);
  return Math.abs(nextOffset - currentOffset) < 1 ? null : nextOffset;
}

function getScrollDelta({
  viewport,
  input,
  bottomInset,
  marginAbove,
  marginBelow,
}: FocusedInputScrollInput): number {
  const visibleBottom = viewport.top + viewport.height - bottomInset;
  if (input.height > visibleBottom - viewport.top) {
    return input.top - viewport.top;
  }

  const overflowBelow = input.top + input.height + marginBelow - visibleBottom;
  if (overflowBelow > 0) {
    return overflowBelow;
  }

  const overflowAbove = viewport.top + marginAbove - input.top;
  if (overflowAbove > 0) {
    // 아래 여백을 지키는 범위에서만 되돌린다
    return Math.max(-overflowAbove, overflowBelow);
  }

  return 0;
}

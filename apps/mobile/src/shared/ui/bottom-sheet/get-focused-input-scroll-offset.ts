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
  const height = Math.max(0, Math.min(viewport.height, keyboardTop - viewportTopLimit));
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
export function getFocusedInputScrollOffset({
  viewport,
  content,
  input,
  bottomInset,
  marginAbove,
  marginBelow,
}: FocusedInputScrollInput): number | null {
  const inputBottom = input.top + input.height;
  if (input.top < content.top || inputBottom > content.top + content.height) {
    return null;
  }

  const visibleBottom = viewport.top + viewport.height - bottomInset;
  const overflowBelow = inputBottom + marginBelow - visibleBottom;
  const overflowAbove = viewport.top + marginAbove - input.top;
  const fitsInput = input.height <= visibleBottom - viewport.top;

  let delta = 0;
  if (!fitsInput) {
    delta = input.top - viewport.top;
  } else if (overflowBelow > 0) {
    delta = overflowBelow;
  } else if (overflowAbove > 0) {
    // 아래 여백을 지키는 범위에서만 되돌린다
    delta = Math.max(-overflowAbove, overflowBelow);
  }
  if (delta === 0) {
    return null;
  }

  const currentOffset = viewport.top - content.top;
  const maxOffset = Math.max(0, content.height - viewport.height);
  const nextOffset = Math.min(Math.max(currentOffset + delta, 0), maxOffset);
  return Math.abs(nextOffset - currentOffset) < 1 ? null : nextOffset;
}

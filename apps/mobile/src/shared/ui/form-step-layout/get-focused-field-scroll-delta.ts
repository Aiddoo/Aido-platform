/** 창 좌표 기준 세로 범위(위·아래 끝) */
export interface VerticalSpan {
  top: number;
  bottom: number;
}

export interface FocusedFieldScrollLayout {
  /** 키보드와 키보드 위 버튼을 뺀, 스크롤 영역에서 실제로 보이는 곳 */
  visible: VerticalSpan;
  /** 포커스한 칸 전체(라벨·입력 칸·오류 문구·글자 수) */
  field: VerticalSpan;
  /** 커서 줄. 모르면 입력 칸 첫 줄 */
  caret: VerticalSpan;
}

/**
 * 칸 전체가 보이도록 스크롤할 양(양수면 내용이 위로 올라간다). 이미 보이면 0.
 * 칸이 보이는 곳보다 크면 커서 줄이 남는 한 칸 아래(입력 끝·글자 수)를 버튼 위에 맞추고,
 * 아니면 칸 위를 보이는 곳 위에 맞춘다. 키보드가 낮아져 보이는 곳이 넓어지면 칸 아래를 버튼 위에 둔 채 되돌린다.
 * 커서 줄은 어느 쪽이든 보이는 곳 안에 둔다
 */
export function getFocusedFieldScrollDelta({
  visible,
  field,
  caret,
}: FocusedFieldScrollLayout): number {
  'worklet';
  const overflowBelow = field.bottom - visible.bottom;
  const roomAbove = field.top - visible.top;
  let delta = 0;
  if (overflowBelow > 0) {
    const keepsCaretVisible = caret.top - overflowBelow >= visible.top;
    delta = keepsCaretVisible ? overflowBelow : Math.max(roomAbove, 0);
  } else if (roomAbove < 0) {
    // 위로 지나간 칸은 칸 아래가 버튼에 다시 가리지 않는 만큼만 되돌린다
    delta = Math.max(roomAbove, overflowBelow);
  }
  delta = Math.max(delta, caret.bottom - visible.bottom);
  return Math.min(delta, caret.top - visible.top);
}

/** 타이핑으로 커서만 움직일 때. 칸 전체를 다시 맞추면 사용자가 옮겨 둔 스크롤을 빼앗으므로 커서 줄만 보이게 한다 */
export function getCaretScrollDelta(visible: VerticalSpan, caret: VerticalSpan): number {
  'worklet';
  if (caret.bottom > visible.bottom) {
    return caret.bottom - visible.bottom;
  }
  return Math.min(caret.top - visible.top, 0);
}

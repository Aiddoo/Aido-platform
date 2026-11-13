import { clamp } from 'react-native-reanimated';

// 칸 아래 끝(오류 문구·글자 수)과 키보드 위 버튼 사이
const FIELD_GAP_ABOVE_FOOTER = 8;

/** 창 좌표 기준 세로 범위(위·아래 끝) */
export interface VerticalSpan {
  top: number;
  bottom: number;
}

/** 스크롤 내용 기준 좌표라 스크롤해도 바뀌지 않는다 */
export interface FocusedFieldInContent {
  top: number;
  bottom: number;
  inputTop: number;
  inputHeight: number;
}

/** 키보드가 fromHeight → toHeight로 움직이는 동안 스크롤을 fromScroll에서 목표까지 같은 비율로 옮긴다 */
export interface KeyboardScrollTransition {
  fromHeight: number;
  toHeight: number;
  fromScroll: number;
}

export interface FocusedFieldScrollLayout {
  /** 키보드와 키보드 위 버튼을 뺀, 스크롤 영역에서 실제로 보이는 곳 */
  visible: VerticalSpan;
  /** 포커스한 칸 전체(라벨·입력 칸·오류 문구·글자 수) */
  field: VerticalSpan;
  /** 커서 줄. 모르면 입력 칸 첫 줄 */
  caret: VerticalSpan;
}

export interface FocusedFieldScrollInput {
  fromScroll: number;
  /** 스크롤 영역의 창 좌표 위 끝과 높이 */
  viewport: { top: number; height: number };
  windowHeight: number;
  keyboardHeight: number;
  /** 키보드 위에 붙은 버튼 높이 */
  footerHeight: number;
  field: FocusedFieldInContent;
  /** 입력 기준 커서 줄. 모르면 null */
  caret: VerticalSpan | null;
}

/** 칸 전체가 보이도록 스크롤할 양(양수면 내용이 위로). 칸이 보이는 곳보다 크면 커서 줄이 남는 한 칸 아래를, 아니면 칸 위를 맞춘다 */
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

// worklet 플러그인은 함수 선언을 끌어올리지 않으므로 쓰는 함수보다 먼저 둔다
function getVisibleSpan({
  viewport,
  windowHeight,
  keyboardHeight,
  footerHeight,
}: FocusedFieldScrollInput): VerticalSpan {
  'worklet';
  return {
    top: viewport.top,
    bottom:
      Math.min(viewport.top + viewport.height, windowHeight - keyboardHeight - footerHeight) -
      FIELD_GAP_ABOVE_FOOTER,
  };
}

/** 키보드 컨트롤러가 알린 커서 줄이 입력 밖이어도 입력 안으로 자른다 */
function getCaretSpan({ field, caret }: FocusedFieldScrollInput, contentTop: number): VerticalSpan {
  'worklet';
  const inputTop = contentTop + field.inputTop;
  if (caret == null) {
    return { top: inputTop, bottom: inputTop };
  }
  return {
    top: inputTop + clamp(caret.top, 0, field.inputHeight),
    bottom: inputTop + clamp(caret.bottom, 0, field.inputHeight),
  };
}

/** 칸 전체가 보이는 스크롤 위치. 아래로는 키보드 높이만큼 비운 여백 덕에 늘 갈 수 있고, 위로는 0(이미 넘었으면 그 자리)을 넘지 않는다 */
export function getFocusedFieldTargetScroll(input: FocusedFieldScrollInput): number {
  'worklet';
  const { fromScroll, keyboardHeight, field } = input;
  if (keyboardHeight === 0) {
    return fromScroll;
  }
  const contentTop = input.viewport.top - fromScroll;
  const delta = getFocusedFieldScrollDelta({
    visible: getVisibleSpan(input),
    field: { top: contentTop + field.top, bottom: contentTop + field.bottom },
    caret: getCaretSpan(input, contentTop),
  });
  return Math.max(fromScroll + delta, Math.min(fromScroll, 0));
}

/** 커서 줄만 보이는 스크롤 위치 */
export function getCaretTargetScroll(input: FocusedFieldScrollInput): number {
  'worklet';
  const contentTop = input.viewport.top - input.fromScroll;
  return (
    input.fromScroll + getCaretScrollDelta(getVisibleSpan(input), getCaretSpan(input, contentTop))
  );
}

/** 키보드가 움직인 비율만큼 fromScroll에서 targetScroll로 옮긴 스크롤 위치 */
export function getKeyboardTransitionScroll(
  { fromHeight, toHeight, fromScroll }: KeyboardScrollTransition,
  keyboardHeight: number,
  targetScroll: number,
): number {
  'worklet';
  const progress =
    toHeight === fromHeight
      ? 1
      : clamp((keyboardHeight - fromHeight) / (toHeight - fromHeight), 0, 1);
  return fromScroll + (targetScroll - fromScroll) * progress;
}

/** 칸 전체를 알리지 않는 입력(코드 입력처럼 숨은 TextInput)은 입력 자체를 칸으로 본다. 포커스한 순간의 창 좌표라 fromScroll 기준으로 바꾼다 */
export function toFocusedInputField(
  input: { absoluteY: number; height: number },
  viewportTop: number,
  fromScroll: number,
): FocusedFieldInContent {
  'worklet';
  const top = input.absoluteY - viewportTop + fromScroll;
  return { top, bottom: top + input.height, inputTop: top, inputHeight: input.height };
}

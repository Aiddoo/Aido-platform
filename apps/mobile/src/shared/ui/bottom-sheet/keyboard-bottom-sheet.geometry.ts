import { HANDLE_HEIGHT } from './bottom-sheet.constants';
import { getSheetMaxHeight } from './get-sheet-layout';

interface KeyboardHiddenHeightInput {
  /** 스크롤 내용 높이(손잡이 제외) */
  contentHeight: number;
  keyboardHeight: number;
  /** gorhom `maxDynamicContentSize` */
  maxSheetHeight: number;
  windowHeight: number;
  /** 시트 위쪽 한계 */
  topInset: number;
}

interface BodyHeightAboveKeyboardInput {
  /** 키보드 위 끝(창 좌표) */
  keyboardTop: number;
  topInset: number;
  maxSheetHeight: number;
  /** 손잡이 밖에 내용이 쓰지 못하는 높이(위 여백·footer) */
  reservedHeight: number;
}

/** 키보드 시트는 아래 여백 없이 위쪽 한계까지 올라간다. gorhom 최대 높이는 손잡이를 포함한다 */
export function getKeyboardSheetMaxHeight(windowHeight: number, topInset: number): number {
  return getSheetMaxHeight(windowHeight, topInset, 0) - HANDLE_HEIGHT;
}

/** 시트가 위쪽 한계에 닿아 바닥이 키보드에 가린 높이. 키보드가 없거나 시트가 키보드 위에 다 들어가면 null */
export function getKeyboardHiddenHeight({
  contentHeight,
  keyboardHeight,
  maxSheetHeight,
  windowHeight,
  topInset,
}: KeyboardHiddenHeightInput): number | null {
  'worklet';
  const sheetHeight = Math.min(contentHeight + HANDLE_HEIGHT, maxSheetHeight);
  const hiddenHeight = sheetHeight + keyboardHeight - (windowHeight - topInset);
  return keyboardHeight > 0 && hiddenHeight >= 0 ? hiddenHeight : null;
}

/** 키보드 위에 남는 내용 높이. 시트는 최대 높이와 키보드 위 공간 중 작은 쪽까지만 보인다 */
export function getBodyHeightAboveKeyboard({
  keyboardTop,
  topInset,
  maxSheetHeight,
  reservedHeight,
}: BodyHeightAboveKeyboardInput): number {
  return Math.min(maxSheetHeight, keyboardTop - topInset) - HANDLE_HEIGHT - reservedHeight;
}

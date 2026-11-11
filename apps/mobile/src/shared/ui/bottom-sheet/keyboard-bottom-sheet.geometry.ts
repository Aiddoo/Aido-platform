import { HANDLE_HEIGHT, SHEET_CONTENT_PADDING } from './bottom-sheet.constants';
import type { SheetHorizontalMargins } from './get-sheet-horizontal-margins';
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

interface KeyboardSheetContentPaddingInput {
  /** 시트 바깥 좌우 여백(`getSheetLayout`) */
  margins: SheetHorizontalMargins;
  /** 창의 좌우 safe area */
  safeAreaInsets: SheetHorizontalMargins;
}

interface KeyboardSheetTopInsetInput {
  /** 쉬는 시트의 위쪽 한계. 위쪽 safe area와 시트에 겹치는 occlusion 중 아래쪽(`getSheetLayout`) */
  topInset: number;
  safeAreaTop: number;
}

/** 키보드 시트는 아래 여백 없이 위쪽 한계까지 올라간다. gorhom 최대 높이는 손잡이를 포함한다 */
export function getKeyboardSheetMaxHeight(windowHeight: number, topInset: number): number {
  return getSheetMaxHeight(windowHeight, topInset, 0) - HANDLE_HEIGHT;
}

/** 키보드가 올린 시트의 위쪽 한계. 쉬는 시트는 occlusion(접은 Duo 레일의 상태 표시) 아래에 두지만, 그 아래와 키보드 사이에는 입력·선택지·주 버튼이 함께 들어가지 않아(접은 Duo: 170~374의 204pt, 카테고리 시트 309pt) 시스템 시트처럼 위쪽 safe area까지 올린다. 시트는 내용 높이만큼만 올라간다 */
export function getKeyboardSheetTopInset({
  topInset,
  safeAreaTop,
}: KeyboardSheetTopInsetInput): number {
  return Math.min(topInset, safeAreaTop);
}

/** 내용·footer의 좌우 여백. 시트 면은 레일까지 덮어도 내용은 시트가 덮은 가로 safe area만큼 더 들여, 키보드가 시트를 레일 상태 표시 위로 올려도 입력·버튼이 그 밑에 들지 않는다(접은 Duo 오른쪽 84) */
export function getKeyboardSheetContentPadding({
  margins,
  safeAreaInsets,
}: KeyboardSheetContentPaddingInput): SheetHorizontalMargins {
  return {
    left: SHEET_CONTENT_PADDING + Math.max(0, safeAreaInsets.left - margins.left),
    right: SHEET_CONTENT_PADDING + Math.max(0, safeAreaInsets.right - margins.right),
  };
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

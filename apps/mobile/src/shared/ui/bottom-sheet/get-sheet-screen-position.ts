export interface MeasuredPosition {
  pageX: number;
  pageY: number;
  width: number;
  height: number;
}

interface SheetScreenPositionInput {
  /** 시트 안 뷰를 `measure`로 잰 값 */
  position: MeasuredPosition;
  /** 같은 방식으로 잰 시트 내용의 왼쪽 위와 폭 */
  sheetOrigin: MeasuredPosition;
  /** 화면 위에서 시트 위 모서리까지 */
  sheetTop: number;
  windowWidth: number;
}

// 네이티브 시트 안 뷰는 measure가 시트가 뜬 자리가 아니라 React 트리 속 시트 자리 기준이라, 시트 안 위치에 시트가 뜬 자리를 더한다
export function getSheetScreenPosition({
  position,
  sheetOrigin,
  sheetTop,
  windowWidth,
}: SheetScreenPositionInput): MeasuredPosition {
  // 창보다 좁은 시트(iPad, iOS 26 위로 띄운 시트)는 가운데에 뜬다
  const sheetLeft = (windowWidth - sheetOrigin.width) / 2;

  return {
    ...position,
    pageX: sheetLeft + position.pageX - sheetOrigin.pageX,
    pageY: sheetTop + position.pageY - sheetOrigin.pageY,
  };
}

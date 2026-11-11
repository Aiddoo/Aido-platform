import { SHEET_CONTENT_PADDING } from './bottom-sheet.constants';

/** 줄 내용에서 칩의 가로 위치. `x`는 줄 앞 여백 뒤에서 잰다 */
interface ChipFrame {
  x: number;
  width: number;
}

interface ChipRevealInput {
  chip: ChipFrame;
  /** 지금 스크롤 위치 */
  scrollX: number;
  /** 줄이 보이는 폭 */
  rowWidth: number;
}

/** 칩이 줄 양 끝 여백 안에 다 보이도록 미는 가장 작은 스크롤 위치. 이미 다 보이면 null이라 누른 칩이 줄 앞으로 끌려가지 않는다 */
export function getChipRevealScrollX({ chip, scrollX, rowWidth }: ChipRevealInput): number | null {
  if (chip.x < scrollX) {
    return chip.x;
  }
  const overflow = chip.x + chip.width + SHEET_CONTENT_PADDING * 2 - (scrollX + rowWidth);
  return overflow > 0 ? scrollX + overflow : null;
}

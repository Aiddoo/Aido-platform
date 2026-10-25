import { chunk, range } from 'es-toolkit';

import { type Invite, InvitePolicy } from '../../domains/invite.model';

export type PawPrintState = 'stamped' | 'waiting' | 'empty' | 'milestone';

export interface PawPrintCell {
  /** 첫 판부터 0으로 센 발자국 순서 */
  index: number;
  state: PawPrintState;
  /** 처음 보는 발자국이라 찍히는 애니메이션을 한 번 보여 줄지 */
  isNew: boolean;
  /** 다음 초대가 채울 칸. 빈 판에서 어디부터 찍히는지 보여 준다 */
  isNext: boolean;
  /** 같은 줄 앞 칸과 잇는 생선 뼈. 줄의 첫 칸이면 null */
  connectorBefore: { isFilled: boolean } | null;
}

export interface PawPrintRow {
  cells: PawPrintCell[];
  /** 다음 줄로 꺾어 내려가는 연결선 위치(지그재그). 마지막 줄이면 null */
  turn: { side: 'end' | 'start'; isFilled: boolean } | null;
}

export interface PawPrintBoard {
  /** 1부터 센 판 번호 */
  boardNumber: number;
  /** 지금까지 찍힌 발자국 */
  totalPawPrints: number;
  /** 이 판을 다 채웠다. 축하를 보여 준 뒤 다음에 열면 새 판이 나온다 */
  isComplete: boolean;
  rows: PawPrintRow[];
}

const PAW_PRINT_CELL_SIZE = 56;
const MIN_CONNECTOR_WIDTH = 12;
const COMPACT_COLUMNS = 4;
const REGULAR_COLUMNS = 6;
const ROWS_PER_BOARD = 2;
// 화면 좌우 여백(16×2)과 카드 안쪽 여백(18×2)
const BOARD_HORIZONTAL_INSET = 68;

interface PawPrintBoardLayoutInput {
  /** 화면이 그려지는 창 폭(safe area frame) */
  frameWidth: number;
  /** iPhone Duo 레일·가로 노치처럼 좌우 safe area로 빠지는 폭 */
  insetLeft: number;
  insetRight: number;
  /** 넓은 창(regular)에서 내용을 모으는 ReadableContent 최대 폭 */
  maxContentWidth: number;
}

/**
 * 발자국 판이 실제로 쓰는 폭. 좌우 safe area(Duo 레일)를 뺀 뒤 ReadableContent 최대 폭으로 자르고
 * 화면·카드 여백을 뺀다. 넓은 창(regular)에서도 ReadableContent 폭을 넘지 않는다.
 */
export function calculatePawPrintBoardWidth({
  frameWidth,
  insetLeft,
  insetRight,
  maxContentWidth,
}: PawPrintBoardLayoutInput) {
  const contentWidth = Math.min(frameWidth - insetLeft - insetRight, maxContentWidth);
  return Math.max(contentWidth - BOARD_HORIZONTAL_INSET, 0);
}

/** 짝수 열만 써서 iPhone Duo·폴더블 접힘선이 두 칸 사이에 오게 한다 */
export function calculatePawPrintColumns(availableWidth: number) {
  const regularMinWidth =
    REGULAR_COLUMNS * PAW_PRINT_CELL_SIZE + (REGULAR_COLUMNS - 1) * MIN_CONNECTOR_WIDTH;
  return availableWidth >= regularMinWidth ? REGULAR_COLUMNS : COMPACT_COLUMNS;
}

/** 판 하나의 칸 수. 판 크기가 정해져 있어 발자국이 늘어도 화면이 커지지 않는다 */
export function calculateBoardSize(columns: number) {
  return columns * ROWS_PER_BOARD;
}

/**
 * 지금 보여 줄 판(0부터). 판을 막 채웠고 아직 축하하지 않았으면 그 판을 한 번 더 보여 주고,
 * 다음에 열 때 새 판으로 넘어간다.
 */
export function calculateBoardIndex(
  pawPrintedCount: number,
  boardSize: number,
  celebratedCount: number,
) {
  const isJustFilled =
    pawPrintedCount > 0 && pawPrintedCount % boardSize === 0 && celebratedCount < pawPrintedCount;
  return isJustFilled ? pawPrintedCount / boardSize - 1 : Math.floor(pawPrintedCount / boardSize);
}

interface PawPrintCountInput {
  pawPrintedCount: number;
  waitingCount: number;
  milestoneCounts: readonly number[];
}

export function calculatePawPrintState(
  index: number,
  { pawPrintedCount, waitingCount, milestoneCounts }: PawPrintCountInput,
): PawPrintState {
  if (index < pawPrintedCount) {
    return 'stamped';
  }
  if (index < pawPrintedCount + waitingCount) {
    return 'waiting';
  }

  return milestoneCounts.includes(index + 1) ? 'milestone' : 'empty';
}

interface PawPrintBoardOptions {
  columns: number;
  /** 이 기기에서 이미 찍히는 모습을 본 발자국 수 */
  celebratedCount: number;
}

/** 내 초대 요약에서 지금 판만 지그재그 줄로 만든다. 홀수 줄은 오른쪽에서 왼쪽으로 읽는다 */
export function createPawPrintBoard(
  invite: Invite,
  { columns, celebratedCount }: PawPrintBoardOptions,
): PawPrintBoard {
  const counts: PawPrintCountInput = {
    pawPrintedCount: invite.qualifiedCount,
    waitingCount: invite.waitingCount,
    milestoneCounts: InvitePolicy.milestoneQualifiedCounts(),
  };
  const isPawPrinted = (index: number) => index < counts.pawPrintedCount;
  const boardSize = calculateBoardSize(columns);
  const boardIndex = calculateBoardIndex(counts.pawPrintedCount, boardSize, celebratedCount);
  const firstIndex = boardIndex * boardSize;
  const rowIndexes = chunk(range(firstIndex, firstIndex + boardSize), columns);

  return {
    boardNumber: boardIndex + 1,
    totalPawPrints: counts.pawPrintedCount,
    isComplete: counts.pawPrintedCount >= firstIndex + boardSize,
    rows: rowIndexes.map((indexes, rowIndex) => {
      const orderedIndexes = rowIndex % 2 === 0 ? indexes : [...indexes].reverse();
      const lastIndex = indexes[indexes.length - 1] ?? firstIndex;
      const isLastRow = rowIndex === rowIndexes.length - 1;

      return {
        cells: orderedIndexes.map((index, position) => ({
          index,
          state: calculatePawPrintState(index, counts),
          isNew: isPawPrinted(index) && index >= celebratedCount,
          isNext: index === counts.pawPrintedCount + counts.waitingCount,
          connectorBefore:
            position === 0
              ? null
              : {
                  isFilled: isPawPrinted(
                    Math.min(index, orderedIndexes[position - 1] ?? index) + 1,
                  ),
                },
        })),
        turn: isLastRow
          ? null
          : { side: rowIndex % 2 === 0 ? 'end' : 'start', isFilled: isPawPrinted(lastIndex + 1) },
      };
    }),
  };
}

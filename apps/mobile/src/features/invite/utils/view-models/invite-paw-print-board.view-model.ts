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
  /** 이 판에 남은 칸보다 많아 판에 그리지 못한 기다리는 친구 수. 판은 찍힌 발자국으로만 채워진다 */
  waitingOverflowCount: number;
  rows: PawPrintRow[];
}

/**
 * 판 하나의 칸 수. 기기 폭과 상관없이 모두 같아서 같은 사람은 어느 기기에서나 같은 판 번호·축하 시점을 본다.
 * 좁은 창은 4열 × 3줄, 넓은 창은 6열 × 2줄로 놓는다.
 */
export const PAW_PRINT_BOARD_SIZE = 12;

const PAW_PRINT_CELL_SIZE = 56;
const MIN_CONNECTOR_WIDTH = 12;
// 생선 뼈 굵기(w-3·h-3)
const FISH_BONE_THICKNESS = 12;
const COMPACT_COLUMNS = 4;
const REGULAR_COLUMNS = 6;
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

export interface PawPrintGrid {
  columns: number;
  /** 발자국 칸 지름. 좁은 폭에서는 56pt보다 작아져 판이 카드 밖으로 넘치지 않는다 */
  cellSize: number;
  /** 같은 줄 두 칸 사이 생선 뼈 길이. 모든 줄이 같은 값을 써서 열 위치가 줄마다 같다 */
  connectorLength: number;
  /** 한 줄 전체 폭. 쓸 수 있는 폭을 넘지 않는다 */
  rowWidth: number;
  /** 줄을 꺾는 세로 생선 뼈가 칸 가운데에 오도록 줄 끝에서 띄우는 폭 */
  turnInset: number;
}

/**
 * 실제로 잰 판 폭에서 모든 줄이 같이 쓰는 열 격자를 만든다.
 * 칸과 생선 뼈 길이를 정수 pt로 정해 모든 줄이 같은 x에 놓이고, 줄 폭이 판 폭을 넘지 않는다.
 */
export function calculatePawPrintGrid(availableWidth: number): PawPrintGrid {
  const width = Math.max(availableWidth, 0);
  const columns = calculatePawPrintColumns(width);
  const gapCount = columns - 1;
  const cellSize = Math.max(
    Math.min(PAW_PRINT_CELL_SIZE, Math.floor((width - gapCount * MIN_CONNECTOR_WIDTH) / columns)),
    0,
  );
  const connectorLength = Math.max(Math.floor((width - columns * cellSize) / gapCount), 0);

  return {
    columns,
    cellSize,
    connectorLength,
    rowWidth: columns * cellSize + gapCount * connectorLength,
    turnInset: Math.max((cellSize - FISH_BONE_THICKNESS) / 2, 0),
  };
}

/**
 * 지금 보여 줄 판(0부터). 판을 막 채웠고 아직 축하하지 않았으면 그 판을 한 번 더 보여 주고,
 * 다음에 열 때 새 판으로 넘어간다.
 */
export function calculateBoardIndex(pawPrintedCount: number, celebratedCount: number) {
  const isJustFilled =
    pawPrintedCount > 0 &&
    pawPrintedCount % PAW_PRINT_BOARD_SIZE === 0 &&
    celebratedCount < pawPrintedCount;
  return isJustFilled
    ? pawPrintedCount / PAW_PRINT_BOARD_SIZE - 1
    : Math.floor(pawPrintedCount / PAW_PRINT_BOARD_SIZE);
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

/** 찍힌 발자국 뒤에 이어 그리는 기다리는 칸 중 판 끝(boardEndIndex)을 넘는 수 */
export function calculateWaitingOverflow(
  { pawPrintedCount, waitingCount }: Pick<PawPrintCountInput, 'pawPrintedCount' | 'waitingCount'>,
  boardEndIndex: number,
) {
  const waitingStart = Math.max(pawPrintedCount, boardEndIndex);
  return Math.min(Math.max(pawPrintedCount + waitingCount - waitingStart, 0), waitingCount);
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
  const boardIndex = calculateBoardIndex(counts.pawPrintedCount, celebratedCount);
  const firstIndex = boardIndex * PAW_PRINT_BOARD_SIZE;
  const rowIndexes = chunk(range(firstIndex, firstIndex + PAW_PRINT_BOARD_SIZE), columns);

  return {
    boardNumber: boardIndex + 1,
    totalPawPrints: counts.pawPrintedCount,
    isComplete: counts.pawPrintedCount >= firstIndex + PAW_PRINT_BOARD_SIZE,
    waitingOverflowCount: calculateWaitingOverflow(counts, firstIndex + PAW_PRINT_BOARD_SIZE),
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
